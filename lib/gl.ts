#!/usr/bin/env -S deno run -A
/**
 * gl - giterloper CLI. Run with: deno run -A lib/gl.ts [command] [args]
 */
import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import { EXIT, GlError, fail } from "./errors.ts";
import { makeQueueFilename, safeName } from "./add-queue.ts";
import { run } from "./run.ts";
import { mutatePins, readPins, resolvePin } from "./pinned.ts";
import { resolveShaOrRef } from "./git.ts";
import { mergeBranchesRemotely, parseGithubSource } from "./github.ts";
import { makeState } from "./gl-core.ts";
import type { GlState } from "./gl-core.ts";
import { cloneDir, ensureDir, stagedDir } from "./paths.ts";
import {
  assertBranchFresh,
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
import {
  clonePin,
  removeStagedDir,
  teardownPinData,
  updatePinSha,
  verifyCloneAtSha,
} from "./pin-lifecycle.ts";

function cmdPinList(state: GlState, args: string[]) {
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

async function cmdPinAdd(state: GlState, args: string[]) {
  const helpText = [
    "Usage: gl pin add <name> <source> [--ref <ref|sha>] [--branch <branch>]",
    "",
    "Adds a pin. Semantics:",
    "  Branch only (--branch X):  Resolve SHA from that branch, pin to both, clone from SHA.",
    "  SHA only (--ref <sha>):   Pin to SHA only (no branch), clone from SHA. Short SHAs (7+ hex chars) are expanded.",
    "  Branch + SHA (--ref <sha> --branch X): Pin both; use the SHA you passed (not derived), clone from SHA.",
    "",
    "Branch is stored for write ops (add, promote). Clone always uses the SHA.",
  ].join("\n");
  ensureHelpNotRequested(args, helpText);
  if (args.length < 2) fail("usage: gl pin add <name> <source> [--ref <ref|sha>] [--branch <branch>]", EXIT.USER);
  const name = args[0];
  const source = args[1];
  let rest = args.slice(2);
  const refParsed = parseFlag(rest, "--ref");
  rest = refParsed.args;
  const branchParsed = parseFlag(rest, "--branch");
  rest = branchParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const branch = branchParsed.found ? branchParsed.value : undefined;
  const refInput = (refParsed.found ? refParsed.value : branch || "HEAD") ?? "HEAD";

  const sha = await resolveShaOrRef(source, refInput);

  const newPin = { name, source, sha, branch: branch ?? undefined };
  const pins = readPins(state);
  const existing = pins.find((p) => p.name === name);
  try {
    clonePin(state, newPin, { infoFn: info });
  } catch (e) {
    teardownPinData(state, newPin);
    throw e;
  }

  mutatePins(state, (pins) => {
    const updated = pins.filter((p) => p.name !== name);
    updated.unshift(newPin);
    return updated;
  });
  if (existing) {
    teardownPinData(state, existing);
    removeStagedDir(state, existing.name, existing.branch);
  }
  commandOutput(
    { name, source, ref: refInput, sha, branch: branch || null, action: "pin-added" },
    state.globalJson
  );
}

function cmdPinRemove(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl pin remove <name>",
      "Removes pin and tears down associated clone if present.",
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

async function cmdPinUpdate(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl pin update <name> [--ref <ref>]",
      "Resolves a new SHA, clones it, and updates pin.",
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
  const ref = (refParsed.found ? refParsed.value : oldPin.branch || "HEAD") ?? "HEAD";
  const newSha = await resolveShaOrRef(oldPin.source, ref);
  if (newSha.toLowerCase() === oldPin.sha.toLowerCase()) {
    commandOutput({ name, sha: newSha, updated: false, reason: "already at requested sha" }, state.globalJson);
    return;
  }
  const hadStaged = oldPin.branch ? existsSync(stagedDir(state, oldPin.name, oldPin.branch)) : false;
  updatePinSha(state, name, newSha, { infoFn: info });
  if (hadStaged && oldPin.branch) {
    removeStagedDir(state, oldPin.name, oldPin.branch);
    const newPin = { ...oldPin, sha: newSha };
    ensureWorkingClone(state, newPin, { infoFn: info });
  }
  commandOutput({ name, oldSha: oldPin.sha, newSha, updated: true }, state.globalJson);
}

function cmdVerify(state: GlState, args: string[], cmdName: string = "verify") {
  ensureHelpNotRequested(
    args,
    [`Usage: gl ${cmdName} [--pin <name>] [--json]`, "Verifies pin and clone health, and branch freshness."].join(
      "\n"
    )
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

function cmdInsert(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl insert [--pin <name>] [--name <name>]", "Reads stdin and queues content in knowledge/pending/."].join("\n")
  );
  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  const nameParsed = parseFlag(rest, "--name");
  rest = nameParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);

  const pin = resolvePin(state, pinParsed.found ? pinParsed.value : null);
  requirePinBranch(pin, "insert");
  const dir = ensureWorkingClone(state, pin, { infoFn: info });
  assertBranchFresh(state, pin, dir);
  const content = readStdinOrFail();
  const folder = "knowledge/pending";
  const fileName = makeQueueFilename(content, nameParsed.found ? nameParsed.value : null);
  const folderPath = path.join(dir, folder);
  ensureDir(folderPath);
  let outPath = path.join(folderPath, fileName);
  if (existsSync(outPath)) {
    const suffix = createHash("sha256").update(content).digest("hex").slice(0, 8);
    outPath = path.join(folderPath, `${safeName(fileName.replace(/\.md$/i, ""))}-${suffix}.md`);
  }
  writeFileSync(outPath, content.endsWith("\n") ? content : `${content}\n`, "utf8");

  commitIfDirty(dir, `gl: insert ${path.basename(outPath)}`);
  pushBranchOrFail(dir, pin, "insert");
  const newSha = run("git", ["-C", dir, "rev-parse", "HEAD"]);
  updatePinSha(state, pin.name, newSha, { infoFn: info });
  commandOutput(
    {
      action: "inserted",
      pin: pin.name,
      branch: pin.branch,
      file: path.basename(outPath),
      sha: newSha,
    },
    state.globalJson
  );
}

function cmdPinLoad(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl pin load [--pin <name>]", "Ensures pinned version(s) are shallow-cloned. Omit --pin to load all."].join("\n")
  );
  let rest = [...args];
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pins = pinParsed.found ? [resolvePin(state, pinParsed.value)] : readPins(state);
  if (pins.length === 0) fail("no pins configured", EXIT.STATE);

  const results: Array<{ pin: string; status: "already_loaded" | "loaded" | "failed"; error?: string }> = [];
  for (const pin of pins) {
    const cdir = cloneDir(state, pin);
    const alreadyLoaded = existsSync(cdir) && verifyCloneAtSha(pin, cdir);
    if (alreadyLoaded) {
      results.push({ pin: pin.name, status: "already_loaded" });
      continue;
    }
    try {
      clonePin(state, pin, { infoFn: info });
      results.push({ pin: pin.name, status: "loaded" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ pin: pin.name, status: "failed", error: msg });
    }
  }
  commandOutput(state.globalJson ? results : results.map((r) => r.error ? `${r.pin}: failed - ${r.error}` : `${r.pin}: ${r.status}`).join("\n"), state.globalJson);
  const anyFailed = results.some((r) => r.status === "failed");
  if (anyFailed) fail("one or more pins failed to load", EXIT.EXTERNAL);
}

async function cmdMerge(state: GlState, args: string[]) {
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

  if (cmd === "diagnostic") return cmdVerify(state, rest, "diagnostic");
  if (cmd === "pin") {
    if (rest.length === 0) fail("usage: gl pin <list|add|remove|update|load>", EXIT.USER);
    const [sub, ...subArgs] = rest;
    if (sub === "list") return cmdPinList(state, subArgs);
    if (sub === "add") return await cmdPinAdd(state, subArgs);
    if (sub === "remove") return cmdPinRemove(state, subArgs);
    if (sub === "update") return await cmdPinUpdate(state, subArgs);
    if (sub === "load") return cmdPinLoad(state, subArgs);
    fail(`unknown pin subcommand "${sub}"`, EXIT.USER);
  }
  if (cmd === "insert") return cmdInsert(state, rest);
  if (cmd === "merge") return await cmdMerge(state, rest);

  fail(`unknown command "${cmd}". Run "gl --help".`, EXIT.USER);
}

// Exports for gl-maintenance.ts
export {
  cmdVerify,
  cmdPinList,
  cmdPinAdd,
  cmdPinRemove,
  cmdPinUpdate,
  cmdPinLoad,
  cmdInsert,
  cmdMerge,
};

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    if (e instanceof GlError) {
      console.error(`gl: ${e.message}`);
      Deno.exit(e.code);
    }
    console.error(`gl: unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    Deno.exit(EXIT.EXTERNAL);
  }
}
