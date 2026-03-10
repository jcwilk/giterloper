#!/usr/bin/env -S deno run -A
/**
 * gl - giterloper CLI. Run with: deno run -A lib/gl.ts [command] [args]
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { chunkDocument } from "./chunk.ts";
import { EXIT, GlError, fail } from "./errors.ts";
import {
  chooseMatchedKnowledgePath,
  makeQueueFilename,
  normalizeKnowledgeRelPath,
  parseSearchJson,
  safeName,
} from "./reconcile.ts";
import { isBranchNotFoundError, run, runSoft } from "./run.ts";
import {
  ensureGiterloperRoot,
  mutatePins,
  parsePinned,
  readPins,
  resolvePin,
  serializePins,
  writePinsAtomic,
} from "./pinned.ts";
import { resolveSha, setCloneIdentity, toRemoteUrl } from "./git.ts";
import { mergeBranchesRemotely, parseGithubSource } from "./github.ts";
import { cloneDir, ensureDir, findProjectRoot, stagedDir } from "./paths.ts";
import {
  ensureGitignoreEntries,
  readLocalConfig,
  writeLocalConfig,
} from "./config.ts";
import {
  assertBranchFresh,
  assertBranchReadyForWrite,
  branchFreshSoft,
  commitIfDirty,
  ensureWorkingClone,
  pushBranchOrFail,
  requirePinBranch,
} from "./branch.ts";
import {
  consumeBooleanFlag,
  commandOutput,
  ensureHelpNotRequested,
  info,
  parseFlag,
  printTopHelp,
  readStdinOrFail,
} from "./cli.ts";
import { detectGpuMode, ensureGpuConfig } from "./gpu.ts";
import {
  clonePin,
  indexPin,
  removeStagedDir,
  teardownPinData,
  updatePinSha,
  verifyCloneAtSha,
} from "./pin-lifecycle.ts";
import {
  assertCollectionHealthy,
  collectionExists,
  collectionName,
  contextExists,
  indexName,
  needsEmbeddingCount,
  pinQmd,
} from "./qmd.ts";

export function cmdGpu(state: { rootDir: string; globalJson: boolean; gpuMode: string | null }, args: string[]) {
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
  const out = { gpuMode: detected.mode, reason: detected.reason };
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

export function cmdStatus(state: ReturnType<typeof makeState>, args: string[]) {
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

export function cmdPinList(state: ReturnType<typeof makeState>, args: string[]) {
  ensureHelpNotRequested(args, ["Usage: gl pin list [--json]", "Lists all pins."].join("\n"));
  const pins = readPins(state);
  if (pins.length === 0) {
    commandOutput(state.globalJson ? [] : "No pins configured.", state.globalJson);
    return;
  }
  commandOutput(
    state.globalJson
      ? pins
      : pins
          .map((pin, idx) => {
            const branchInfo = pin.branch ? ` [${pin.branch}]` : "";
            return `${idx === 0 ? "*" : " "} ${pin.name}: ${pin.source}@${pin.sha}${branchInfo}`;
          })
          .join("\n"),
    state.globalJson
  );
}

export function cmdPinAdd(state: ReturnType<typeof makeState>, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl pin add <name> <source> [--ref <ref>] [--branch <branch>]",
      "Adds or replaces a pin entry. Resolves source+ref to a full SHA.",
      "If --branch is given and the branch does not exist on the remote, gl creates it",
      "from the ref (use --ref main --branch my_branch to branch off main).",
    ].join("\n")
  );
  if (args.length < 2) fail("usage: gl pin add <name> <source> [--ref <ref>] [--branch <branch>]", EXIT.USER);
  const name = args[0];
  const source = args[1];
  let rest = args.slice(2);
  const refParsed = parseFlag(rest, "--ref");
  rest = refParsed.args;
  const branchParsed = parseFlag(rest, "--branch");
  rest = branchParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const branch = branchParsed.found ? branchParsed.value : undefined;
  const ref = refParsed.found ? refParsed.value : branch || "HEAD";
  const sha = resolveSha(source, ref);
  const newPin = { name, source, sha, branch };
  mutatePins(state, (pins) => {
    const updated = pins.filter((p) => p.name !== name);
    updated.unshift(newPin);
    return updated;
  });
  const fallbackRef = ref !== branch ? ref : "HEAD";
  clonePin(state, newPin, { branch, fallbackRef, infoFn: info });
  ensureGpuConfig(state, info);
  indexPin(state, newPin, { infoFn: info });
  commandOutput({ name, source, ref, branch: branch || null, sha, action: "pin-added" }, state.globalJson);
}

export function cmdPinRemove(state: ReturnType<typeof makeState>, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl pin remove <name>",
      "Removes pin and tears down associated clone/index if present.",
    ].join("\n")
  );
  if (args.length !== 1) fail("usage: gl pin remove <name>", EXIT.USER);
  const name = args[0];
  const pins = readPins(state);
  const target = pins.find((p) => p.name === name);
  if (!target) fail(`pin "${name}" not found`, EXIT.USER);
  teardownPinData(state, target);
  removeStagedDir(state, target.name, target.branch);
  mutatePins(state, (pins) => pins.filter((p) => p.name !== name));
  commandOutput({ name, removed: true }, state.globalJson);
}

export function cmdPinUpdate(state: ReturnType<typeof makeState>, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl pin update <name> [--ref <ref>]",
      "Resolves a new SHA, clones/indexes it, and updates pin.",
    ].join("\n")
  );
  if (args.length < 1) fail("usage: gl pin update <name> [--ref <ref>]", EXIT.USER);
  const name = args[0];
  let rest = args.slice(1);
  const refParsed = parseFlag(rest, "--ref");
  rest = refParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pins = readPins(state);
  const oldPin = pins.find((p) => p.name === name);
  if (!oldPin) fail(`pin "${name}" not found`, EXIT.USER);
  const ref = refParsed.found ? refParsed.value : oldPin.branch || "HEAD";
  const newSha = resolveSha(oldPin.source, ref);
  if (newSha.toLowerCase() === oldPin.sha.toLowerCase()) {
    commandOutput({ name, sha: newSha, updated: false, reason: "already at requested sha" }, state.globalJson);
    return;
  }
  const hadStaged = oldPin.branch ? existsSync(stagedDir(state, oldPin.name, oldPin.branch)) : false;
  updatePinSha(state, name, newSha, { branch: ref, infoFn: info });
  if (hadStaged && oldPin.branch) {
    removeStagedDir(state, oldPin.name, oldPin.branch);
    const newPin = { ...oldPin, sha: newSha };
    ensureWorkingClone(state, newPin, { infoFn: info });
  }
  commandOutput({ name, oldSha: oldPin.sha, newSha, updated: true }, state.globalJson);
}

export function cmdClone(state: ReturnType<typeof makeState>, args: string[]) {
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
  for (const pin of pins) clonePin(state, pin, { branch: pin.branch, infoFn: info });
  commandOutput({ cloned: pins.map(collectionName) }, state.globalJson);
}

export function cmdIndex(state: ReturnType<typeof makeState>, args: string[]) {
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

export function cmdTeardown(state: ReturnType<typeof makeState>, args: string[]) {
  ensureHelpNotRequested(args, ["Usage: gl teardown <name>", "Tears down pin, clone, and qmd collection."].join("\n"));
  if (args.length !== 1) fail("usage: gl teardown <name>", EXIT.USER);
  cmdPinRemove(state, args);
}

export function cmdSearchLike(state: ReturnType<typeof makeState>, mode: "search" | "query", args: string[]) {
  const helpText = [
    mode === "search"
      ? "Usage: gl search <query> [--pin <name>] [-n N] [--json]"
      : "Usage: gl query <question> [--pin <name>] [--json]",
    `Runs qmd ${mode} scoped to the selected pin collection.`,
  ].join("\n");
  ensureHelpNotRequested(args, helpText);
  if (args.length < 1) fail(`usage: gl ${mode} <${mode === "search" ? "query" : "question"}>`, EXIT.USER);
  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  const nParsed = mode === "search" ? parseFlag(rest, "-n") : { found: false, value: null, args: rest };
  rest = nParsed.args;
  if (rest.length < 1) fail(`missing ${mode} text`, EXIT.USER);
  const text = rest.join(" ");
  const pin = resolvePin(state, pinParsed.found ? pinParsed.value : null);
  const collection = collectionName(pin);
  const cmdArgs = [mode, text, "-c", collection];
  if (mode === "search" && nParsed.found) cmdArgs.push("-n", nParsed.value!);
  if (state.globalJson) cmdArgs.push("--json");
  const out = run("qmd", pinQmd(pin, cmdArgs));
  commandOutput(out);
}

export function cmdGet(state: ReturnType<typeof makeState>, args: string[]) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl get <path> [--pin <name>] [--full] [--json]", "Runs qmd get scoped to selected pin collection."].join(
      "\n"
    )
  );
  if (args.length < 1) fail("usage: gl get <path> [--pin <name>] [--full]", EXIT.USER);
  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  const fullParsed = consumeBooleanFlag(rest, "--full");
  rest = fullParsed.args;
  if (rest.length < 1) fail("missing path argument", EXIT.USER);
  const docPath = rest.join(" ");
  const pin = resolvePin(state, pinParsed.found ? pinParsed.value : null);
  const collection = collectionName(pin);
  const cmdArgs = ["get", docPath, "-c", collection];
  if (fullParsed.found) cmdArgs.push("--full");
  if (state.globalJson) cmdArgs.push("--json");
  const out = run("qmd", pinQmd(pin, cmdArgs));
  commandOutput(out);
}

export function cmdStage(state: ReturnType<typeof makeState>, args: string[]) {
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
  ensureDir(path.dirname(dir));
  const url = toRemoteUrl(pin.source);
  if (pin.branch && branch === pin.branch) {
    const result = runSoft("git", ["clone", "--depth", "1", "--branch", branch, url, dir]);
    if (!result.ok) {
      if (isBranchNotFoundError(result)) {
        if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
        info(`branch "${branch}" not found; creating from default branch`);
        run("git", ["clone", "--depth", "1", url, dir]);
        run("git", ["-C", dir, "checkout", "-b", branch]);
      } else {
        fail(`git clone failed: ${(result.stderr || result.stdout).trim()}`, EXIT.EXTERNAL);
      }
    }
  } else {
    run("git", ["clone", "--depth", "1", url, dir]);
    run("git", ["-C", dir, "checkout", "-b", branch]);
  }
  setCloneIdentity(dir);
  commandOutput({ staged: dir, branch, pin: pin.name, created: true }, state.globalJson);
}

export function cmdPromote(state: ReturnType<typeof makeState>, args: string[]) {
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

export function cmdStageCleanup(state: ReturnType<typeof makeState>, args: string[]) {
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

export function cmdVerify(state: ReturnType<typeof makeState>, args: string[]) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl verify [--pin <name>] [--json]", "Verifies pin, clone, collection, vector health, and branch freshness."].join(
      "\n"
    )
  );
  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pins = pinParsed.found ? [resolvePin(state, pinParsed.value)] : readPins(state);
  if (pins.length === 0) fail("no pins configured", EXIT.STATE);
  const results = [];
  for (const pin of pins) {
    const cdir = cloneDir(state, pin);
    const collection = collectionName(pin);
    const clonePresent = existsSync(cdir);
    const cloneShaOk = clonePresent ? verifyCloneAtSha(pin, cdir) : false;
    const collectionPresent = collectionExists(pin, collection);
    const contextPresent = contextExists(pin, collection);
    const freshness = branchFreshSoft(state, pin);
    let vectorsOk = false;
    if (collectionPresent) {
      const status = runSoft("qmd", pinQmd(pin, ["status"]));
      if (status.ok) {
        const statusText = status.stdout.toLowerCase();
        vectorsOk = statusText.includes(collection.toLowerCase()) && !statusText.includes("vectors: 0");
      }
    }
    results.push({
      pin: pin.name,
      branch: pin.branch || null,
      sha: pin.sha,
      clonePath: cdir,
      clonePresent,
      cloneShaOk,
      collection,
      collectionPresent,
      contextPresent,
      vectorsOk,
      workingClonePath: pin.branch ? stagedDir(state, pin.name, pin.branch) : null,
      workingCloneExists: pin.branch ? existsSync(stagedDir(state, pin.name, pin.branch)) : false,
      workingCloneSha: freshness.localSha,
      branchFresh: freshness.fresh,
      ok: clonePresent && cloneShaOk && collectionPresent && contextPresent && vectorsOk,
    });
  }
  const allOk = results.every((r) => r.ok);
  commandOutput({ ok: allOk, checks: results }, state.globalJson);
  if (!allOk) fail("verify: not all pins are healthy", EXIT.STATE);
}

function cmdDiagnostic(state: ReturnType<typeof makeState>, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl diagnostic [--pin <name>] [--json]",
      "Runs a comprehensive health check: pins, clones, collections, vectors, and branch freshness.",
    ].join("\n")
  );
  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pins = pinParsed.found ? [resolvePin(state, pinParsed.value)] : readPins(state);
  if (pins.length === 0) fail("no pins configured", EXIT.STATE);
  const checks = [];
  for (const pin of pins) {
    const cdir = cloneDir(state, pin);
    const collection = collectionName(pin);
    const clonePresent = existsSync(cdir);
    const cloneShaOk = clonePresent ? verifyCloneAtSha(pin, cdir) : false;
    const collectionPresent = collectionExists(pin, collection);
    const contextPresent = contextExists(pin, collection);
    const freshness = branchFreshSoft(state, pin);
    let vectorsOk = false;
    if (collectionPresent) {
      const status = runSoft("qmd", pinQmd(pin, ["status"]));
      if (status.ok) {
        const statusText = status.stdout.toLowerCase();
        vectorsOk = statusText.includes(collection.toLowerCase()) && !statusText.includes("vectors: 0");
      }
    }
    checks.push({
      pin: pin.name,
      branch: pin.branch || null,
      sha: pin.sha,
      clonePath: cdir,
      clonePresent,
      cloneShaOk,
      collection,
      collectionPresent,
      contextPresent,
      vectorsOk,
      workingClonePath: pin.branch ? stagedDir(state, pin.name, pin.branch) : null,
      workingCloneExists: pin.branch ? existsSync(stagedDir(state, pin.name, pin.branch)) : false,
      workingCloneSha: freshness.localSha,
      branchFresh: freshness.fresh,
      ok: clonePresent && cloneShaOk && collectionPresent && contextPresent && vectorsOk,
    });
  }
  const allOk = checks.every((r) => r.ok);
  const out = {
    ok: allOk,
    projectRoot: state.projectRoot,
    giterloperRoot: state.rootDir,
    pinnedPath: state.pinnedPath,
    checks,
  };
  commandOutput(out, state.globalJson);
  if (!allOk) fail("diagnostic: not all pins are healthy", EXIT.STATE);
}

export function cmdAddLike(state: ReturnType<typeof makeState>, args: string[], mode: "add" | "subtract") {
  const helpText =
    mode === "add"
      ? ["Usage: gl add [--pin <name>] [--name <name>]", "Reads stdin and queues content in added/."].join("\n")
      : ["Usage: gl subtract [--pin <name>] [--name <name>]", "Reads stdin and queues content in subtracts/."].join(
          "\n"
        );
  ensureHelpNotRequested(args, helpText);

  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  const nameParsed = parseFlag(rest, "--name");
  rest = nameParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);

  const pin = resolvePin(state, pinParsed.found ? pinParsed.value : null);
  requirePinBranch(pin, mode);
  const dir = ensureWorkingClone(state, pin, { infoFn: info });
  assertBranchFresh(state, pin, dir);
  const content = readStdinOrFail();
  const folder = mode === "add" ? "added" : "subtracts";
  const fileName = makeQueueFilename(content, nameParsed.found ? nameParsed.value : null);
  const folderPath = path.join(dir, folder);
  ensureDir(folderPath);
  let outPath = path.join(folderPath, fileName);
  if (existsSync(outPath)) {
    const suffix = createHash("sha256").update(content).digest("hex").slice(0, 8);
    outPath = path.join(folderPath, `${safeName(fileName.replace(/\.md$/i, ""))}-${suffix}.md`);
  }
  writeFileSync(outPath, content.endsWith("\n") ? content : `${content}\n`, "utf8");

  commitIfDirty(dir, `gl: ${mode} ${path.basename(outPath)}`);
  pushBranchOrFail(dir, pin, mode);
  const newSha = run("git", ["-C", dir, "rev-parse", "HEAD"]);
  updatePinSha(state, pin.name, newSha, { infoFn: info });
  commandOutput(
    {
      action: mode === "add" ? "added" : "subtracted",
      pin: pin.name,
      branch: pin.branch,
      file: path.basename(outPath),
      sha: newSha,
    },
    state.globalJson
  );
}

export function cmdReconcile(state: ReturnType<typeof makeState>, args: string[]) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl reconcile [--pin <name>]", "Reconciles added/ and subtracts/ queues into knowledge/."].join("\n")
  );
  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pin = resolvePin(state, pinParsed.found ? pinParsed.value : null);
  requirePinBranch(pin, "reconcile");
  const dir = ensureWorkingClone(state, pin, { infoFn: info });
  assertBranchFresh(state, pin, dir);

  const processQueue = (queueName: string) => {
    const queueDir = path.join(dir, queueName);
    if (!existsSync(queueDir)) return { files: 0, commits: 0 };
    const files = readdirSync(queueDir).filter((f) => f.toLowerCase().endsWith(".md")).sort();
    let commits = 0;

    for (const file of files) {
      const filePath = path.join(queueDir, file);
      const content = readFileSync(filePath, "utf8");
      const chunks = chunkDocument(content).map((chunk) => chunk.text).filter(Boolean);

      for (const rawChunk of chunks) {
        const chunk = rawChunk.trim();
        if (!chunk) continue;
        const searchOut = run("qmd", pinQmd(pin, ["search", chunk.slice(0, 1500), "-c", collectionName(pin), "--json", "-n", "3"]));
        const results = parseSearchJson(searchOut);
        const matchedPath = chooseMatchedKnowledgePath(results);

        if (queueName === "added") {
          const targetRel = matchedPath || file;
          const target = path.join(dir, "knowledge", normalizeKnowledgeRelPath(targetRel) || file);
          ensureDir(path.dirname(target));
          const before = existsSync(target) ? readFileSync(target, "utf8").trimEnd() : "";
          const next = [before, "", `<!-- reconciled from added/${file} -->`, "", chunk, ""].filter(Boolean).join("\n");
          writeFileSync(target, `${next}\n`, "utf8");
        } else if (matchedPath) {
          const target = path.join(dir, "knowledge", matchedPath);
          if (existsSync(target)) {
            const before = readFileSync(target, "utf8");
            const after = before.replace(chunk, "").replace(/\n{3,}/g, "\n\n");
            if (after !== before) {
              writeFileSync(target, after.endsWith("\n") ? after : `${after}\n`, "utf8");
            }
          }
        }
      }

      unlinkSync(filePath);
      if (commitIfDirty(dir, queueName === "added" ? `gl: reconcile add ${file}` : `gl: reconcile subtract ${file}`)) {
        commits += 1;
      }
    }

    return { files: files.length, commits };
  };

  const added = processQueue("added");
  const subtracted = processQueue("subtracts");
  const totalCommits = added.commits + subtracted.commits;
  let newSha = pin.sha;
  if (totalCommits > 0) {
    pushBranchOrFail(dir, pin, "reconcile");
    newSha = run("git", ["-C", dir, "rev-parse", "HEAD"]);
    updatePinSha(state, pin.name, newSha, { infoFn: info });
  }

  commandOutput(
    {
      action: "reconciled",
      pin: pin.name,
      branch: pin.branch,
      added: added.files,
      subtracted: subtracted.files,
      commits: totalCommits,
      newSha,
    },
    state.globalJson
  );
}

export async function cmdMerge(state: ReturnType<typeof makeState>, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl merge <source-pin> <target-pin>",
      "Merges one branched pin into another via GitHub API (no local fetch).",
      "Source and target must point to the same github.com repo.",
    ].join("\n")
  );
  if (args.length !== 2) fail("usage: gl merge <source-pin> <target-pin>", EXIT.USER);
  const source = resolvePin(state, args[0]);
  const target = resolvePin(state, args[1]);
  requirePinBranch(source, "merge");
  requirePinBranch(target, "merge");

  if (source.source !== target.source) {
    fail(
      `merge requires same repo: source "${source.name}" and target "${target.name}" point to different sources. ` +
        "Use GitHub to merge across repositories.",
      EXIT.USER
    );
  }
  if (!parseGithubSource(source.source)) {
    fail("merge requires github.com source", EXIT.USER);
  }

  const commitMessage = `gl: merge ${source.name} into ${target.name}`;
  const result = await mergeBranchesRemotely(
    source.source,
    target.branch!,
    source.branch!,
    commitMessage
  );

  updatePinSha(state, target.name, result.sha, { infoFn: info });
  commandOutput(
    {
      action: "merged",
      source: { pin: source.name, branch: source.branch, sha: source.sha },
      target: { pin: target.name, branch: target.branch, oldSha: target.sha, newSha: result.sha },
    },
    state.globalJson
  );
}

export function makeState() {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    fail("no .git directory found in current path or parents", EXIT.STATE);
  }
  const state = {
    projectRoot,
    rootDir: path.join(projectRoot, ".giterloper"),
    versionsDir: path.join(projectRoot, ".giterloper", "versions"),
    stagedRoot: path.join(projectRoot, ".giterloper", "staged"),
    pinnedPath: path.join(projectRoot, ".giterloper", "pinned.yaml"),
    localConfigPath: path.join(projectRoot, ".giterloper", "local.json"),
    globalJson: false,
    gpuMode: null as string | null,
  };
  Deno.env.set("XDG_CONFIG_HOME", path.join(state.rootDir, "qmd", "config"));
  Deno.env.set("XDG_CACHE_HOME", path.join(state.rootDir, "qmd", "cache"));
  const localConfig = readLocalConfig(state);
  state.gpuMode = (localConfig.gpuMode as string) || null;
  if (state.gpuMode === "cpu") {
    Deno.env.set("NODE_LLAMA_CPP_GPU", "false");
  }
  return state;
}

async function main() {
  let args = [...Deno.args];
  const helpJsonParsed = consumeBooleanFlag(args, "--json");
  args = helpJsonParsed.args;
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printTopHelp();
    return;
  }
  const state = makeState();
  state.globalJson = helpJsonParsed.found;

  const [cmd, ...rest] = args;

  if (cmd === "diagnostic") return cmdDiagnostic(state, rest);
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
  if (cmd === "promote") return cmdPromote(state, rest);

  fail(`unknown command "${cmd}". Run "gl --help".`, EXIT.USER);
}

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    if (e instanceof GlError) {
      console.error(`gl: ${e.message}`);
      Deno.exit(e.code);
    }
    console.error(`gl: unexpected error: ${e?.message ?? e}`);
    Deno.exit(EXIT.EXTERNAL);
  }
}
