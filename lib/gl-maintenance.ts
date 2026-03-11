#!/usr/bin/env -S deno run -A
/**
 * gl maintenance - giterloper CLI (maintenance commands only; no overlap with gl).
 * Run with: deno run -A lib/gl-maintenance.ts <command> [args]
 * Or: ./scripts/gl-maintenance <command>
 *
 * Not exposed to the gl skill. For agents: prefer gl (main) commands; use
 * gl-maintenance only when debugging or performing low-level maintenance.
 */
import { existsSync } from "node:fs";

import { EXIT, GlError, fail } from "./errors.ts";
import { consumeBooleanFlag, parseFlag, printMaintenanceHelp } from "./cli.ts";
import { ensureHelpNotRequested, commandOutput, info } from "./cli.ts";
import { makeState } from "./gl-core.ts";
import type { GlState } from "./gl-core.ts";
import { ensureGiterloperRoot, mutatePins, readPins, resolvePin } from "./pinned.ts";
import { cloneDir, stagedDir } from "./paths.ts";
import { run } from "./run.ts";
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
import { clonePin, removeStagedDir, teardownPinData, updatePinSha, verifyCloneAtSha } from "./pin-lifecycle.ts";

function cmdVerify(state: GlState, args: string[], cmdName: string = "verify") {
  ensureHelpNotRequested(
    args,
    [`Usage: gl-maintenance ${cmdName} [--pin <name>] [--json]`, "Verifies pin and clone health, and branch freshness."].join("\n")
  );
  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pins = pinParsed.found ? [resolvePin(state, pinParsed.value)] : readPins(state);
  if (pins.length === 0) fail("no pins configured", EXIT.STATE);
  const results: Array<{
    pin: string;
    branch: string | null;
    sha: string;
    clonePath: string;
    clonePresent: boolean;
    cloneShaOk: boolean;
    workingClonePath: string | null;
    workingCloneExists: boolean;
    workingCloneSha: string | null;
    branchFresh: boolean | null;
    ok: boolean;
  }> = [];
  for (const pin of pins) {
    const cdir = cloneDir(state, pin);
    const clonePresent = existsSync(cdir);
    const cloneShaOk = clonePresent ? verifyCloneAtSha(pin, cdir) : false;
    const freshness = branchFreshSoft(state, pin);
    results.push({
      pin: pin.name,
      branch: pin.branch || null,
      sha: pin.sha,
      clonePath: cdir,
      clonePresent,
      cloneShaOk,
      workingClonePath: pin.branch ? stagedDir(state, pin.name, pin.branch) : null,
      workingCloneExists: pin.branch ? existsSync(stagedDir(state, pin.name, pin.branch)) : false,
      workingCloneSha: freshness.localSha,
      branchFresh: freshness.fresh,
      ok: clonePresent && cloneShaOk,
    });
  }
  const allOk = results.every((r) => r.ok);
  commandOutput({ ok: allOk, checks: results }, state.globalJson);
  if (!allOk) fail("verify: not all pins are healthy", EXIT.STATE);
}

function cmdStatus(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl status [--json]", "Shows pin and clone state."].join("\n")
  );
  ensureGiterloperRoot(state);
  const pins = readPins(state);
  const pinStates = pins.map((pin) => {
    const cdir = cloneDir(state, pin);
    const freshness = branchFreshSoft(state, pin);
    return {
      ...pin,
      clonePath: cdir,
      cloneExists: existsSync(cdir),
      cloneAtExpectedSha: existsSync(cdir) ? verifyCloneAtSha(pin, cdir) : false,
      workingClonePath: pin.branch ? stagedDir(state, pin.name, pin.branch) : null,
      workingCloneExists: pin.branch ? existsSync(stagedDir(state, pin.name, pin.branch)) : false,
      workingCloneSha: freshness.localSha,
      branchFresh: freshness.fresh,
    };
  });
  const out = {
    projectRoot: state.projectRoot,
    giterloperRoot: state.rootDir,
    pinnedPath: state.pinnedPath,
    pins: pinStates,
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
  commandOutput({ cloned: pins.map((p) => p.name) }, state.globalJson);
}

function cmdTeardown(state: GlState, args: string[]) {
  ensureHelpNotRequested(args, ["Usage: gl teardown <name>", "Tears down pin and clone."].join("\n"));
  if (args.length !== 1) fail("usage: gl teardown <name>", EXIT.USER);
  const name = args[0];
  const pins = readPins(state);
  const target = pins.find((p) => p.name === name);
  if (!target) fail(`pin "${name}" not found`, EXIT.USER);
  teardownPinData(state, target);
  removeStagedDir(state, target.name, target.branch);
  mutatePins(state, (pins) => pins.filter((p) => p.name !== name));
  commandOutput({ name, removed: true }, state.globalJson);
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
      "Commits staged clone (if dirty), pushes tracked pin branch, clones new SHA, updates pin.",
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

  if (cmd === "status") return cmdStatus(state, rest);
  if (cmd === "verify") return cmdVerify(state, rest);
  if (cmd === "clone") return cmdClone(state, rest);
  if (cmd === "teardown") return cmdTeardown(state, rest);
  if (cmd === "stage") return cmdStage(state, rest);
  if (cmd === "stage-cleanup") return cmdStageCleanup(state, rest);
  if (cmd === "promote") return cmdPromote(state, rest);

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
