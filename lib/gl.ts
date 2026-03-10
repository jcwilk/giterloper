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
import { run, runSoft } from "./run.ts";
import {
  ensureGiterloperRoot,
  mutatePins,
  readPins,
  resolvePin,
} from "./pinned.ts";
import { resolveSha, resolveShaOrRef } from "./git.ts";
import { mergeBranchesRemotely, parseGithubSource } from "./github.ts";
import { makeState } from "./gl-core.ts";
import type { GlState } from "./gl-core.ts";
import { cloneDir, ensureDir, stagedDir } from "./paths.ts";
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
import {
  consumeBooleanFlag,
  commandOutput,
  ensureHelpNotRequested,
  info,
  parseFlag,
  printTopHelp,
  readStdinOrFail,
} from "./cli.ts";
import { ensureGpuConfig } from "./gpu.ts";
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
    "Branch is stored for write ops (add, subtract, promote, reconcile). Clone always uses the SHA.",
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
    ensureGpuConfig(state, info);
    indexPin(state, newPin, { infoFn: info });
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

async function cmdPinUpdate(state: GlState, args: string[]) {
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

function cmdSearchLike(state: GlState, mode: "search" | "query", args: string[]) {
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

function cmdGet(state: GlState, args: string[]) {
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

function cmdQmdOrphanCleanup(state: GlState, args: string[]) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl-maintenance qmd-orphan-cleanup",
      "Deletes qmd config/cache files whose index does not match any pin in pinned.yaml.",
      "Safe to run after E2E tests to remove orphaned test qmd data.",
    ].join("\n")
  );
  if (args.length > 0) fail("usage: gl-maintenance qmd-orphan-cleanup", EXIT.USER);

  const pins = readPins(state);
  const validIndexNames = new Set(pins.map((p) => indexName(p)));

  const dirs = [
    path.join(state.rootDir, "qmd", "config", "qmd"),
    path.join(state.rootDir, "qmd", "cache", "qmd"),
  ];

  let removed = 0;
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const indexPart = f.includes(".") ? f.slice(0, f.indexOf(".")) : f;
      if (!validIndexNames.has(indexPart)) {
        try {
          unlinkSync(path.join(dir, f));
          removed++;
        } catch {
          /* ignore */
        }
      }
    }
  }

  commandOutput({ removed, dirs: dirs.length }, state.globalJson);
}

function cmdVerify(state: GlState, args: string[], cmdName: string = "verify") {
  ensureHelpNotRequested(
    args,
    [`Usage: gl ${cmdName} [--pin <name>] [--json]`, "Verifies pin, clone, collection, vector health, and branch freshness."].join(
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
    collection: string;
    collectionPresent: boolean;
    contextPresent: boolean;
    vectorsOk: boolean;
    workingClonePath: string | null;
    workingCloneExists: boolean;
    workingCloneSha: string | null;
    branchFresh: boolean | null;
    ok: boolean;
  }> = [];
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

function cmdAddLike(state: GlState, args: string[], mode: "add" | "subtract") {
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

function cmdReconcile(state: GlState, args: string[]) {
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
    if (rest.length === 0) fail("usage: gl pin <list|add|remove|update>", EXIT.USER);
    const [sub, ...subArgs] = rest;
    if (sub === "list") return cmdPinList(state, subArgs);
    if (sub === "add") return await cmdPinAdd(state, subArgs);
    if (sub === "remove") return cmdPinRemove(state, subArgs);
    if (sub === "update") return await cmdPinUpdate(state, subArgs);
    fail(`unknown pin subcommand "${sub}"`, EXIT.USER);
  }
  if (cmd === "search") return cmdSearchLike(state, "search", rest);
  if (cmd === "query") return cmdSearchLike(state, "query", rest);
  if (cmd === "get") return cmdGet(state, rest);
  if (cmd === "add") return cmdAddLike(state, rest, "add");
  if (cmd === "subtract") return cmdAddLike(state, rest, "subtract");
  if (cmd === "reconcile") return cmdReconcile(state, rest);
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
  cmdSearchLike,
  cmdGet,
  cmdAddLike,
  cmdReconcile,
  cmdMerge,
  cmdQmdOrphanCleanup,
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
