#!/usr/bin/env -S deno run -A
/**
 * gl maintenance - giterloper CLI (all commands + maintenance).
 * Run with: deno run -A lib/gl-maintenance.ts <command> [args]
 * Or: ./scripts/gl-maintenance <command>
 *
 * Not exposed to the gl skill. For agents: prefer gl (main) commands; use
 * gl-maintenance only when debugging or performing low-level maintenance.
 */
import { existsSync } from "node:fs";

import { EXIT, GlError, fail } from "./errors.ts";
import { consumeBooleanFlag, parseFlag, printMaintenanceHelp } from "./cli.ts";
import {
  ensureHelpNotRequested,
  commandOutput,
  info,
} from "./cli.ts";
import { makeState } from "./gl-core.ts";
import type { GlState } from "./gl-core.ts";
import {
  cmdVerify,
  cmdPinList,
  cmdPinAdd,
  cmdPinRemove,
  cmdPinUpdate,
  cmdSearchLike,
  cmdGet,
  cmdAddLike,
  cmdReconcile,
  cmdMerge,
  cmdQmdOrphanCleanup,
} from "./gl.ts";
import { ensureGiterloperRoot, readPins, resolvePin } from "./pinned.ts";
import { cloneDir, ensureDir, stagedDir } from "./paths.ts";
import {
  ensureGitignoreEntries,
  writeLocalConfig,
} from "./config.ts";
import { run, runSoft } from "./run.ts";
import {
  assertBranchFresh,
  assertBranchReadyForWrite,
  branchFreshSoft,
  cloneToStaged,
  commitIfDirty,
  ensureWorkingClone,
  pushBranchOrFail,
  requirePinBranch,
} from "./branch.ts";
import { clonePin, indexPin, removeStagedDir, updatePinSha, verifyCloneAtSha } from "./pin-lifecycle.ts";
import { collectionExists, collectionName, contextExists, pinQmd } from "./qmd.ts";
import { detectGpuMode, ensureGpuConfig } from "./gpu.ts";

function cmdGpu(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl gpu [--cpu]",
      "Detects GPU/CUDA availability and updates local config.",
      "Use --cpu to force CPU-only mode without detection.",
    ].join("\n")
  );
  const cpuFlag = consumeBooleanFlag(args, "--cpu");
  const rest = cpuFlag.args;
  if (rest.length > 0) fail("unexpected arguments: gl gpu [--cpu]", EXIT.USER);
  ensureDir(state.rootDir);
  ensureGitignoreEntries(state);
  if (cpuFlag.found) {
    writeLocalConfig(state, { gpuMode: "cpu" });
    state.gpuMode = "cpu";
    Deno.env.set("NODE_LLAMA_CPP_GPU", "false");
    const out = { gpuMode: "cpu", forced: true };
    commandOutput(out, state.globalJson);
    if (!state.globalJson) info("GPU mode set to CPU. Run `gl gpu` without --cpu to re-detect after installing CUDA.");
    return;
  }
  const detected = detectGpuMode();
  writeLocalConfig(state, { gpuMode: detected.mode });
  state.gpuMode = detected.mode;
  if (detected.mode === "cpu") {
    Deno.env.set("NODE_LLAMA_CPP_GPU", "false");
  }
  const out =
    detected.mode === "cpu"
      ? { gpuMode: detected.mode as "cpu", reason: detected.reason }
      : { gpuMode: detected.mode };
  commandOutput(out, state.globalJson);
  if (!state.globalJson) {
    if (detected.mode === "cuda") {
      info("CUDA detected. GPU acceleration enabled.");
    } else if (detected.reason === "no-gpu") {
      info("No NVIDIA GPU detected. Using CPU mode.");
    } else {
      info("NVIDIA GPU detected but CUDA Toolkit not found. Using CPU mode.");
      info("Install CUDA Toolkit from https://developer.nvidia.com/cuda-downloads and run `gl gpu` to re-detect.");
    }
  }
}

function cmdStatus(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl status [--json]",
      "Shows pin, clone, collection, and qmd state.",
    ].join("\n")
  );
  ensureGiterloperRoot(state);
  const pins = readPins(state);
  const pinStates = pins.map((pin) => {
    const collection = collectionName(pin);
    const cdir = cloneDir(state, pin);
    const freshness = branchFreshSoft(state, pin);
    return {
      ...pin,
      clonePath: cdir,
      cloneExists: existsSync(cdir),
      cloneAtExpectedSha: existsSync(cdir) ? verifyCloneAtSha(pin, cdir) : false,
      collection,
      collectionExists: collectionExists(pin, collection),
      contextExists: contextExists(pin, collection),
      workingClonePath: pin.branch ? stagedDir(state, pin.name, pin.branch) : null,
      workingCloneExists: pin.branch ? existsSync(stagedDir(state, pin.name, pin.branch)) : false,
      workingCloneSha: freshness.localSha,
      branchFresh: freshness.fresh,
    };
  });
  const qmdStatuses = pinStates.map((ps) => {
    const pin = pins.find((p) => p.name === ps.name)!;
    const s = runSoft("qmd", pinQmd(pin, ["status"]));
    return { pin: ps.name, status: s.ok ? s.stdout : s.stderr || "qmd status failed" };
  });
  const out = {
    projectRoot: state.projectRoot,
    giterloperRoot: state.rootDir,
    pinnedPath: state.pinnedPath,
    pins: pinStates,
    qmd: qmdStatuses,
  };
  commandOutput(out, state.globalJson);
}

function cmdClone(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl clone [--pin <name> | --all]",
      "Clones pinned version(s) into .giterloper/versions/<name>/<sha>/.",
    ].join("\n")
  );
  let rest = [...args];
  const allParsed = consumeBooleanFlag(rest, "--all");
  rest = allParsed.args;
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  if (allParsed.found && pinParsed.found) fail("use either --all or --pin, not both", EXIT.USER);
  const pins = allParsed.found ? readPins(state) : [resolvePin(state, pinParsed.found ? pinParsed.value : null)];
  for (const pin of pins) clonePin(state, pin, { infoFn: info });
  commandOutput({ cloned: pins.map(collectionName) }, state.globalJson);
}

function cmdIndex(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl index [--pin <name> | --all]",
      "Adds qmd collection/context and runs qmd embed for pinned version(s).",
    ].join("\n")
  );
  let rest = [...args];
  const allParsed = consumeBooleanFlag(rest, "--all");
  rest = allParsed.args;
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  if (allParsed.found && pinParsed.found) fail("use either --all or --pin, not both", EXIT.USER);
  const pins = allParsed.found ? readPins(state) : [resolvePin(state, pinParsed.found ? pinParsed.value : null)];
  ensureGpuConfig(state, info);
  for (const pin of pins) indexPin(state, pin, { infoFn: info });
  commandOutput({ indexed: pins.map(collectionName) }, state.globalJson);
}

function cmdTeardown(state: GlState, args: string[]) {
  ensureHelpNotRequested(args, ["Usage: gl teardown <name>", "Tears down pin, clone, and qmd collection."].join("\n"));
  if (args.length !== 1) fail("usage: gl teardown <name>", EXIT.USER);
  cmdPinRemove(state, args);
}

function cmdStage(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl stage [branch] [--pin <name>]", "Creates staged working clone on a branch."].join("\n")
  );
  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 1) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pin = resolvePin(state, pinParsed.found ? pinParsed.value : null);
  const branch = rest[0] || pin.branch;
  if (!branch) fail("usage: gl stage <branch> [--pin <name>]", EXIT.USER);
  const dir = stagedDir(state, pin.name, branch);
  if (existsSync(dir)) {
    commandOutput({ staged: dir, branch, pin: pin.name, created: false }, state.globalJson);
    return;
  }
  if (pin.branch && branch === pin.branch) {
    assertBranchReadyForWrite(state, pin);
  }
  cloneToStaged(state, pin, branch, { infoFn: info });
  commandOutput({ staged: dir, branch, pin: pin.name, created: true }, state.globalJson);
}

function cmdPromote(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl promote [--pin <name>]",
      "Commits staged clone (if dirty), pushes tracked pin branch, clones/indexes new SHA, updates pin.",
    ].join("\n")
  );
  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pin = resolvePin(state, pinParsed.found ? pinParsed.value : null);
  requirePinBranch(pin, "promote");
  const dir = ensureWorkingClone(state, pin, { infoFn: info });
  assertBranchFresh(state, pin, dir);
  commitIfDirty(dir, `giterloper: promote ${pin.branch}`);
  pushBranchOrFail(dir, pin, "promote");
  const newSha = run("git", ["-C", dir, "rev-parse", "HEAD"]);
  updatePinSha(state, pin.name, newSha, { infoFn: info });
  removeStagedDir(state, pin.name, pin.branch);
  commandOutput({ promoted: true, pin: pin.name, oldSha: pin.sha, newSha, branch: pin.branch }, state.globalJson);
}

function cmdStageCleanup(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl stage-cleanup [branch] [--pin <name>]", "Deletes staged clone without promoting."].join("\n")
  );
  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 1) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pin = resolvePin(state, pinParsed.found ? pinParsed.value : null);
  const branch = rest[0] || pin.branch;
  if (!branch) fail("usage: gl stage-cleanup <branch> [--pin <name>]", EXIT.USER);
  const dir = stagedDir(state, pin.name, branch);
  removeStagedDir(state, pin.name, branch);
  commandOutput({ cleaned: true, path: dir }, state.globalJson);
}

async function main() {
  let args = [...Deno.args];
  const helpJsonParsed = consumeBooleanFlag(args, "--json");
  args = helpJsonParsed.args;
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printMaintenanceHelp();
    return;
  }
  const state = makeState();
  state.globalJson = helpJsonParsed.found;

  const [cmd, ...rest] = args;

  // Main commands (from gl)
  if (cmd === "diagnostic") return cmdVerify(state, rest, "diagnostic");
  if (cmd === "pin") {
    if (rest.length === 0) fail("usage: gl pin <list|add|remove|update>", EXIT.USER);
    const [sub, ...subArgs] = rest;
    if (sub === "list") return cmdPinList(state, subArgs);
    if (sub === "add") return cmdPinAdd(state, subArgs);
    if (sub === "remove") return cmdPinRemove(state, subArgs);
    if (sub === "update") return cmdPinUpdate(state, subArgs);
    fail(`unknown pin subcommand "${sub}"`, EXIT.USER);
  }
  if (cmd === "search") return cmdSearchLike(state, "search", rest);
  if (cmd === "query") return cmdSearchLike(state, "query", rest);
  if (cmd === "get") return cmdGet(state, rest);
  if (cmd === "add") return cmdAddLike(state, rest, "add");
  if (cmd === "subtract") return cmdAddLike(state, rest, "subtract");
  if (cmd === "reconcile") return cmdReconcile(state, rest);
  if (cmd === "merge") return await cmdMerge(state, rest);

  // Maintenance commands
  if (cmd === "status") return cmdStatus(state, rest);
  if (cmd === "verify") return cmdVerify(state, rest);
  if (cmd === "gpu") return cmdGpu(state, rest);
  if (cmd === "clone") return cmdClone(state, rest);
  if (cmd === "index") return cmdIndex(state, rest);
  if (cmd === "teardown") return cmdTeardown(state, rest);
  if (cmd === "stage") return cmdStage(state, rest);
  if (cmd === "stage-cleanup") return cmdStageCleanup(state, rest);
  if (cmd === "promote") return cmdPromote(state, rest);
  if (cmd === "qmd-orphan-cleanup") return cmdQmdOrphanCleanup(state, rest);

  fail(`unknown command "${cmd}". Run "gl-maintenance --help".`, EXIT.USER);
}

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    if (e instanceof GlError) {
      console.error(`gl-maintenance: ${e.message}`);
      Deno.exit(e.code);
    }
    console.error(`gl-maintenance: unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    Deno.exit(EXIT.EXTERNAL);
  }
}
