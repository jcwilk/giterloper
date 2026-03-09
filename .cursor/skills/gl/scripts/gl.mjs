#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const EXIT = {
  OK: 0,
  USER: 1,
  STATE: 2,
  EXTERNAL: 3,
};

class GlError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function fail(message, code = EXIT.USER) {
  throw new GlError(message, code);
}

function info(message) {
  console.error(`gl: ${message}`);
}

function commandOutput(data, asJson = false) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  if (typeof data === "string") {
    process.stdout.write(`${data}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
  if (result.error) {
    fail(`failed to run ${cmd}: ${result.error.message}`, EXIT.EXTERNAL);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    const details = stderr || stdout || `exit code ${result.status}`;
    fail(`${cmd} ${args.join(" ")} failed: ${details}`, EXIT.EXTERNAL);
  }
  return result.stdout.trim();
}

function runSoft(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
  return {
    ok: !result.error && result.status === 0,
    status: result.status ?? 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error,
  };
}

function findProjectRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);
  while (true) {
    if (existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function ensureGiterloperRoot(state) {
  if (!existsSync(state.rootDir)) {
    fail(`missing ${state.rootDir}. Ensure .giterloper/ and pinned.yaml exist.`, EXIT.STATE);
  }
  if (!existsSync(state.pinnedPath)) {
    fail(`missing ${state.pinnedPath}. Add pins via "gl pin add" then run "gl clone" and "gl index".`, EXIT.STATE);
  }
}

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function toRemoteUrl(source) {
  if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("git@")) {
    return source;
  }
  return `https://${source}`;
}

function parsePinned(content) {
  const pins = [];
  let current = null;
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.match(/^ */)?.[0]?.length ?? 0;
    const colon = trimmed.indexOf(":");
    if (colon < 0) continue;

    if (indent === 0) {
      const name = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim();
      if (!name) fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);

      // Backward-compatible with legacy "name: source@sha" one-liner format.
      if (value) {
        const at = value.lastIndexOf("@");
        if (at < 0) fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
        const source = value.slice(0, at).trim();
        const sha = value.slice(at + 1).trim();
        if (!source || !/^[0-9a-f]{40}$/i.test(sha)) {
          fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
        }
        pins.push({ name, source, sha });
        current = null;
        continue;
      }

      current = { name, source: null, sha: null, branch: undefined };
      pins.push(current);
      continue;
    }

    if (!current) fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (!value) fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
    if (key === "repo") current.source = value;
    if (key === "sha") current.sha = value;
    if (key === "branch") current.branch = value;
  }

  for (const pin of pins) {
    if (!pin.source || !/^[0-9a-f]{40}$/i.test(pin.sha || "")) {
      fail(`invalid pinned.yaml entry for "${pin.name}"`, EXIT.STATE);
    }
  }
  return pins;
}

function serializePins(pins) {
  const body = pins
    .map((pin) => {
      const lines = [`${pin.name}:`, `  repo: ${pin.source}`, `  sha: ${pin.sha}`];
      if (pin.branch) lines.push(`  branch: ${pin.branch}`);
      return lines.join("\n");
    })
    .join("\n");
  return `${body}${body ? "\n" : ""}`;
}

function readPins(state) {
  ensureGiterloperRoot(state);
  const content = readFileSync(state.pinnedPath, "utf8");
  return parsePinned(content);
}

function withFifoLock(lockDir, fn, opts = {}) {
  const maxWaitMs = opts.maxWaitMs ?? 5000;
  const pollMs = opts.pollMs ?? 25;
  ensureDir(lockDir);

  const staleCutoff = Date.now() - maxWaitMs * 2;
  const entries = readdirSync(lockDir);
  for (const e of entries) {
    const m = e.match(/^(\d+)_/);
    if (m && parseInt(m[1], 10) < staleCutoff) {
      try {
        unlinkSync(path.join(lockDir, e));
      } catch {}
    }
  }

  const ts = String(Date.now()).padStart(15, "0");
  const ticket = `${ts}_${process.pid}_${randomBytes(4).toString("hex")}`;
  const ticketPath = path.join(lockDir, ticket);
  writeFileSync(ticketPath, "", "utf8");

  try {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const files = readdirSync(lockDir).sort();
      if (files[0] === ticket) break;
      const d = Date.now() + pollMs;
      while (Date.now() < d) {}
    }
    const files = readdirSync(lockDir).sort();
    if (files[0] !== ticket) {
      unlinkSync(ticketPath);
      fail(`could not acquire lock at ${lockDir} within ${maxWaitMs}ms`, EXIT.STATE);
    }
    return fn();
  } finally {
    try {
      unlinkSync(ticketPath);
    } catch {}
  }
}

/** Holds exclusive lock for read-modify-write on pinned.yaml. */
function mutatePins(state, mutator) {
  const lockDir = path.join(state.rootDir, "locks", "pins");
  withFifoLock(lockDir, () => {
    const content = readFileSync(state.pinnedPath, "utf8");
    const pins = parsePinned(content);
    const updated = mutator(pins);
    const temp = `${state.pinnedPath}.tmp`;
    writeFileSync(temp, serializePins(updated), "utf8");
    renameSync(temp, state.pinnedPath);
  }, { maxWaitMs: 5000 });
}

function writePinsAtomic(state, pins) {
  const temp = `${state.pinnedPath}.tmp`;
  writeFileSync(temp, serializePins(pins), "utf8");
  renameSync(temp, state.pinnedPath);
}

function resolvePin(state, pinName) {
  const pins = readPins(state);
  if (pins.length === 0) fail("no pins configured in .giterloper/pinned.yaml", EXIT.STATE);
  if (!pinName) return pins[0];
  const pin = pins.find((p) => p.name === pinName);
  if (!pin) fail(`pin "${pinName}" not found`, EXIT.USER);
  return pin;
}

function collectionName(pin) {
  return `${pin.name}@${pin.sha}`;
}

function indexName(pin) {
  return `${pin.name}_${pin.sha}`;
}

function pinQmd(pin, args) {
  return ["--index", indexName(pin), ...args];
}

function cloneDir(state, pin) {
  return path.join(state.versionsDir, pin.name, pin.sha);
}

function stagedDir(state, pinName, branchName) {
  return path.join(state.stagedRoot, pinName, branchName);
}

function removeStagedDir(state, pinName, branch) {
  if (!branch) return;
  const dir = stagedDir(state, pinName, branch);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  runSoft("rmdir", [path.join(state.stagedRoot, pinName)]);
}

function collectionExists(pin, collection) {
  const out = run("qmd", pinQmd(pin, ["collection", "list"]));
  return out.includes(collection);
}

function contextExists(pin, collection) {
  const out = run("qmd", pinQmd(pin, ["context", "list"]));
  return out.includes(collection);
}

function verifyCloneAtSha(pin, clonePath) {
  if (!existsSync(clonePath)) return false;
  const result = runSoft("git", ["-C", clonePath, "rev-parse", "HEAD"]);
  if (!result.ok || !result.stdout) return false;
  return result.stdout.trim().toLowerCase() === pin.sha.toLowerCase();
}

function resolveSha(source, ref = "HEAD") {
  const remote = toRemoteUrl(source);
  const out = run("git", ["ls-remote", remote, ref]);
  const first = out.split(/\r?\n/).find(Boolean);
  if (!first) fail(`could not resolve ref "${ref}" for ${source}`, EXIT.EXTERNAL);
  const sha = first.split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    fail(`unexpected SHA while resolving ${source}@${ref}: ${sha}`, EXIT.EXTERNAL);
  }
  return sha;
}

function readLocalConfig(state) {
  const p = state.localConfigPath ?? path.join(state.rootDir, "local.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function writeLocalConfig(state, config) {
  const p = state.localConfigPath ?? path.join(state.rootDir, "local.json");
  ensureDir(path.dirname(p));
  const temp = `${p}.tmp`;
  writeFileSync(temp, JSON.stringify(config, null, 2), "utf8");
  renameSync(temp, p);
}

function detectGpuMode() {
  const nvcc = runSoft("nvcc", ["--version"]);
  if (nvcc.ok) return { mode: "cuda" };
  const nvidiaSmi = runSoft("nvidia-smi");
  if (nvidiaSmi.ok) return { mode: "cpu", reason: "no-toolkit" };
  return { mode: "cpu", reason: "no-gpu" };
}

function printCudaInstallInstructions() {
  info("");
  info("CUDA Toolkit is required for GPU acceleration. Install from:");
  info("  https://developer.nvidia.com/cuda-downloads");
  info("");
  info("Ubuntu/Debian example:");
  info("  wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb");
  info("  sudo dpkg -i cuda-keyring_1.1-1_all.deb");
  info("  sudo apt update && sudo apt install cuda-toolkit-13-1");
  info("");
}

function ensureGpuConfig(state) {
  if (state.gpuMode === "cuda") return;
  if (state.gpuMode === "cpu") {
    info("GPU disabled. Install CUDA Toolkit and run `gl gpu` to re-detect.");
    return;
  }
  const detected = detectGpuMode();
  if (detected.mode === "cuda") {
    writeLocalConfig(state, { gpuMode: "cuda" });
    state.gpuMode = "cuda";
    return;
  }
  if (detected.reason === "no-gpu") {
    info("No NVIDIA GPU detected; using CPU mode.");
    writeLocalConfig(state, { gpuMode: "cpu" });
    state.gpuMode = "cpu";
    process.env.NODE_LLAMA_CPP_GPU = "false";
    return;
  }
  printCudaInstallInstructions();
  fail(
    "NVIDIA GPU detected but CUDA Toolkit not found. Install CUDA Toolkit and run `gl gpu`, or run `gl gpu --cpu` to continue in CPU-only mode.",
    EXIT.USER
  );
}

function ensureGitignoreEntries(state) {
  const ignorePath = path.join(state.projectRoot, ".gitignore");
  const required = [".giterloper/versions/", ".giterloper/staged/", ".giterloper/local.json"];
  let current = "";
  if (existsSync(ignorePath)) {
    current = readFileSync(ignorePath, "utf8");
  }
  const lines = current ? current.split(/\r?\n/) : [];
  let changed = false;
  for (const entry of required) {
    if (!lines.some((line) => line.trim() === entry)) {
      lines.push(entry);
      changed = true;
    }
  }
  if (changed) {
    const cleaned = lines.filter((_, idx, arr) => !(idx === arr.length - 1 && arr[idx] === "")).join("\n");
    writeFileSync(ignorePath, `${cleaned}\n`, "utf8");
  }
}

function assertCollectionHealthy(pin, collection) {
  const status = run("qmd", pinQmd(pin, ["status"]));
  const vectorsLine = status
    .split(/\r?\n/)
    .find((line) => line.toLowerCase().includes(collection.toLowerCase()) && line.toLowerCase().includes("vector"));
  if (vectorsLine) {
    const numberMatch = vectorsLine.match(/vectors[^0-9]*(\d+)/i);
    if (numberMatch && Number(numberMatch[1]) <= 0) {
      fail(`collection ${collection} has zero vectors`, EXIT.STATE);
    }
  }
}

function parseFlag(args, longName, shortName = null) {
  const idxLong = args.indexOf(longName);
  const idxShort = shortName ? args.indexOf(shortName) : -1;
  const idx = idxLong >= 0 ? idxLong : idxShort;
  if (idx < 0) return { found: false, value: null, args };
  if (idx + 1 >= args.length || args[idx + 1].startsWith("-")) {
    fail(`missing value for ${longName}`, EXIT.USER);
  }
  const value = args[idx + 1];
  const next = args.slice(0, idx).concat(args.slice(idx + 2));
  return { found: true, value, args: next };
}

function consumeBooleanFlag(args, longName) {
  const idx = args.indexOf(longName);
  if (idx < 0) return { found: false, args };
  return { found: true, args: args.slice(0, idx).concat(args.slice(idx + 1)) };
}

function resolveBranchSha(source, branch) {
  const remote = toRemoteUrl(source);
  const out = runSoft("git", ["ls-remote", "--heads", remote, branch]);
  if (!out.ok || !out.stdout) {
    fail(`could not resolve branch "${branch}" for ${source}`, EXIT.EXTERNAL);
  }
  const first = out.stdout.split(/\r?\n/).find(Boolean);
  const sha = first?.split(/\s+/)?.[0];
  if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) {
    fail(`unexpected SHA while resolving ${source}@${branch}: ${sha || "<none>"}`, EXIT.EXTERNAL);
  }
  return sha;
}

function requirePinBranch(pin, operation) {
  if (pin.branch) return;
  fail(
    `pin "${pin.name}" has no branch. ${operation} requires a branched pin. Add one with "gl pin add ${pin.name} ${pin.source} --branch <branch>".`,
    EXIT.USER
  );
}

function setCloneIdentity(dir) {
  const name = runSoft("git", ["-C", dir, "config", "user.name"]);
  if (!name.ok || !name.stdout.trim()) {
    run("git", ["-C", dir, "config", "user.name", "giterloper"]);
  }
  const email = runSoft("git", ["-C", dir, "config", "user.email"]);
  if (!email.ok || !email.stdout.trim()) {
    run("git", ["-C", dir, "config", "user.email", "giterloper@localhost"]);
  }
}

function ensureWorkingClone(state, pin) {
  requirePinBranch(pin, "write operation");
  const dir = stagedDir(state, pin.name, pin.branch);
  if (!existsSync(dir)) {
    ensureDir(path.dirname(dir));
    run("git", ["clone", "--depth", "1", "--branch", pin.branch, toRemoteUrl(pin.source), dir]);
  }
  setCloneIdentity(dir);
  return dir;
}

function assertBranchFresh(state, pin, workingDir) {
  if (!pin.branch) return;
  const localSha = run("git", ["-C", workingDir, "rev-parse", "HEAD"]);
  const remoteSha = resolveBranchSha(pin.source, pin.branch);
  if (localSha.toLowerCase() === remoteSha.toLowerCase()) return;
  fail(
    [
      `branch "${pin.branch}" for pin "${pin.name}" is stale.`,
      `  Local HEAD:  ${localSha}`,
      `  Remote HEAD: ${remoteSha}`,
      "  The remote branch has commits not present in your working clone.",
      `  To sync: run "gl pin update ${pin.name}" to pull the latest, then retry.`,
      "  If you have local uncommitted work in the staged clone, you can also run:",
      `    git -C ${stagedDir(state, pin.name, pin.branch)} pull --rebase`,
    ].join("\n"),
    EXIT.STATE
  );
}

function branchFreshSoft(state, pin) {
  if (!pin.branch) return { fresh: null, localSha: null, remoteSha: null };
  const dir = stagedDir(state, pin.name, pin.branch);
  if (!existsSync(dir)) return { fresh: null, localSha: null, remoteSha: null };
  const local = runSoft("git", ["-C", dir, "rev-parse", "HEAD"]);
  const remote = runSoft("git", ["ls-remote", "--heads", toRemoteUrl(pin.source), pin.branch]);
  if (!local.ok || !remote.ok || !remote.stdout) {
    return { fresh: null, localSha: local.stdout || null, remoteSha: null };
  }
  const remoteSha = remote.stdout.split(/\r?\n/).find(Boolean)?.split(/\s+/)?.[0];
  if (!remoteSha) return { fresh: null, localSha: local.stdout || null, remoteSha: null };
  return {
    fresh: local.stdout.trim().toLowerCase() === remoteSha.trim().toLowerCase(),
    localSha: local.stdout.trim(),
    remoteSha: remoteSha.trim(),
  };
}

function commitIfDirty(dir, message) {
  const status = run("git", ["-C", dir, "status", "--porcelain"]);
  if (!status) return false;
  run("git", ["-C", dir, "add", "-A"]);
  run("git", ["-C", dir, "commit", "-m", message]);
  return true;
}

function pushBranchOrFail(dir, pin, operationName) {
  const pushed = runSoft("git", ["-C", dir, "push", "-u", "origin", pin.branch]);
  if (pushed.ok) return;
  fail(
    [
      `${operationName} failed while pushing branch "${pin.branch}" for pin "${pin.name}".`,
      "The branch may be stale or diverged on remote.",
      `Git output: ${(pushed.stderr || pushed.stdout || "push failed").trim()}`,
      `Try syncing with "gl pin update ${pin.name}" and retry.`,
    ].join("\n"),
    EXIT.STATE
  );
}

function updatePinSha(state, pinName, newSha, opts = {}) {
  const pins = readPins(state);
  const target = pins.find((p) => p.name === pinName);
  if (!target) fail(`pin "${pinName}" not found`, EXIT.USER);
  const oldPin = { ...target };
  const newPin = { ...target, sha: newSha };
  const cloneBranch = opts.branch ?? newPin.branch;

  clonePin(state, newPin, { branch: cloneBranch });
  ensureGpuConfig(state);
  indexPin(state, newPin);
  teardownPinData(state, oldPin);

  mutatePins(state, (pins) => {
    const updated = pins.filter((p) => p.name !== pinName);
    updated.unshift(newPin);
    return updated;
  });
}

function readStdinOrFail() {
  const text = readFileSync(0, "utf8");
  if (!text || !text.trim()) fail("stdin content is required", EXIT.USER);
  return text;
}

function safeName(input) {
  const cleaned = String(input || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "entry";
}

function makeQueueFilename(content, nameArg) {
  if (nameArg) {
    const base = safeName(nameArg);
    return base.toLowerCase().endsWith(".md") ? base : `${base}.md`;
  }
  return `${createHash("sha256").update(content).digest("hex").slice(0, 12)}.md`;
}

function parseSearchJson(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeKnowledgeRelPath(pathFromSearch) {
  const p = String(pathFromSearch || "").replace(/^\/+/, "");
  if (!p) return null;
  return p.startsWith("knowledge/") ? p.slice("knowledge/".length) : p;
}

function chooseMatchedKnowledgePath(results) {
  for (const r of results) {
    const candidate = r?.path || r?.filepath || r?.file || r?.docPath || r?.docpath;
    if (candidate) return normalizeKnowledgeRelPath(candidate);
  }
  return null;
}

function printTopHelp() {
  commandOutput(
    [
      "gl - giterloper CLI",
      "",
      "Usage:",
      "  gl <command> [subcommand] [options]",
      "",
      "Commands:",
      "  status",
      "  gpu [--cpu]",
      "  pin list|add|remove|update",
      "  clone [--pin <name>|--all]",
      "  index [--pin <name>|--all]",
      "  teardown <name>",
      "  search <query> [--pin <name>] [-n N] [--json]",
      "  query <question> [--pin <name>] [--json]",
      "  get <path> [--pin <name>] [--full] [--json]",
      "  stage [branch] [--pin <name>]",
      "  promote [--pin <name>]",
      "  stage-cleanup [branch] [--pin <name>]",
      "  add [--pin <name>] [--name <name>]",
      "  subtract [--pin <name>] [--name <name>]",
      "  reconcile [--pin <name>]",
      "  merge <source-pin> <target-pin>",
      "  verify [--pin <name>] [--json]",
      "",
      'Run "gl <command> --help" for command-specific usage.',
    ].join("\n")
  );
}

function ensureHelpNotRequested(args, text) {
  if (args.includes("--help") || args.includes("-h")) {
    commandOutput(text);
    process.exit(EXIT.OK);
  }
}

function cmdGpu(state, args) {
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
    process.env.NODE_LLAMA_CPP_GPU = "false";
    const out = { gpuMode: "cpu", forced: true };
    commandOutput(out, state.globalJson);
    if (!state.globalJson) info("GPU mode set to CPU. Run `gl gpu` without --cpu to re-detect after installing CUDA.");
    return;
  }
  const detected = detectGpuMode();
  writeLocalConfig(state, { gpuMode: detected.mode });
  state.gpuMode = detected.mode;
  if (detected.mode === "cpu") {
    process.env.NODE_LLAMA_CPP_GPU = "false";
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

function cmdStatus(state, args) {
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
    const pin = pins.find((p) => p.name === ps.name);
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

function cmdPinList(state, args) {
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

function cmdPinAdd(state, args) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl pin add <name> <source> [--ref <ref>] [--branch <branch>]",
      "Adds or replaces a pin entry. Resolves source+ref to a full SHA.",
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
  clonePin(state, newPin, { branch });
  ensureGpuConfig(state);
  indexPin(state, newPin);
  commandOutput({ name, source, ref, branch: branch || null, sha, action: "pin-added" }, state.globalJson);
}

function cmdPinRemove(state, args) {
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

function cmdPinUpdate(state, args) {
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
  updatePinSha(state, name, newSha, { branch: ref });
  if (hadStaged && oldPin.branch) {
    removeStagedDir(state, oldPin.name, oldPin.branch);
    const newPin = { ...oldPin, sha: newSha };
    ensureWorkingClone(state, newPin);
  }
  commandOutput({ name, oldSha: oldPin.sha, newSha, updated: true }, state.globalJson);
}

function clonePin(state, pin, opts = {}) {
  const cdir = cloneDir(state, pin);
  if (existsSync(cdir) && verifyCloneAtSha(pin, cdir)) {
    info(`clone already exists for ${collectionName(pin)}`);
    return;
  }
  ensureDir(path.dirname(cdir));
  if (existsSync(cdir)) rmSync(cdir, { recursive: true, force: true });
  const cloneArgs = ["clone", "--depth", "1"];
  const branch = opts.branch || pin.branch;
  if (branch) cloneArgs.push("--branch", branch);
  cloneArgs.push(toRemoteUrl(pin.source), cdir);
  run("git", cloneArgs);
  run("git", ["-C", cdir, "checkout", pin.sha]);
  if (!verifyCloneAtSha(pin, cdir)) {
    fail(`cloned repository at ${cdir} is not at expected SHA ${pin.sha}`, EXIT.STATE);
  }
}

function indexPin(state, pin) {
  const cdir = cloneDir(state, pin);
  if (!existsSync(cdir)) fail(`clone missing: ${cdir}`, EXIT.STATE);
  // Intentionally index only knowledge/ (added/ and subtracts/ remain unindexed queue folders).
  const knowledge = path.join(cdir, "knowledge");
  if (!existsSync(knowledge)) fail(`knowledge directory missing: ${knowledge}`, EXIT.STATE);
  const collection = collectionName(pin);
  if (!collectionExists(pin, collection)) {
    run("qmd", pinQmd(pin, ["collection", "add", knowledge, "--name", collection, "--mask", "**/*.md"]));
  } else {
    info(`collection ${collection} already exists`);
  }
  if (!contextExists(pin, collection)) {
    run("qmd", pinQmd(pin, ["context", "add", `qmd://${collection}`, `${pin.name} at ${pin.sha}`]));
  }
  const embedLockDir = path.join(state.rootDir, "locks", "embed");
  withFifoLock(embedLockDir, () => run("qmd", pinQmd(pin, ["embed"])), { maxWaitMs: 300000 });
  assertCollectionHealthy(pin, collection);
}

function cleanupQmdFiles(state, pin) {
  const prefix = `${indexName(pin)}.`;
  const dirs = [
    path.join(state.rootDir, "qmd", "config", "qmd"),
    path.join(state.rootDir, "qmd", "cache", "qmd"),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (f.startsWith(prefix)) {
        try {
          unlinkSync(path.join(dir, f));
        } catch {}
      }
    }
  }
}

function teardownPinData(state, pin) {
  const collection = collectionName(pin);
  runSoft("qmd", pinQmd(pin, ["context", "rm", `qmd://${collection}`]));
  runSoft("qmd", pinQmd(pin, ["collection", "remove", collection]));
  cleanupQmdFiles(state, pin);
  const cdir = cloneDir(state, pin);
  if (existsSync(cdir)) rmSync(cdir, { recursive: true, force: true });
  runSoft("rmdir", [path.join(state.versionsDir, pin.name)]);
}

function cmdClone(state, args) {
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
  for (const pin of pins) clonePin(state, pin, { branch: pin.branch });
  commandOutput({ cloned: pins.map(collectionName) }, state.globalJson);
}

function cmdIndex(state, args) {
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
  ensureGpuConfig(state);
  for (const pin of pins) indexPin(state, pin);
  commandOutput({ indexed: pins.map(collectionName) }, state.globalJson);
}

function cmdTeardown(state, args) {
  ensureHelpNotRequested(args, ["Usage: gl teardown <name>", "Tears down pin, clone, and qmd collection."].join("\n"));
  if (args.length !== 1) fail("usage: gl teardown <name>", EXIT.USER);
  cmdPinRemove(state, args);
}

function cmdSearchLike(state, mode, args) {
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
  if (mode === "search" && nParsed.found) cmdArgs.push("-n", nParsed.value);
  if (state.globalJson) cmdArgs.push("--json");
  const out = run("qmd", pinQmd(pin, cmdArgs));
  commandOutput(out);
}

function cmdGet(state, args) {
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

function cmdStage(state, args) {
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
  ensureDir(path.dirname(dir));
  if (pin.branch && branch === pin.branch) {
    run("git", ["clone", "--depth", "1", "--branch", branch, toRemoteUrl(pin.source), dir]);
  } else {
    run("git", ["clone", "--depth", "1", toRemoteUrl(pin.source), dir]);
    run("git", ["-C", dir, "checkout", "-b", branch]);
  }
  setCloneIdentity(dir);
  commandOutput({ staged: dir, branch, pin: pin.name, created: true }, state.globalJson);
}

function cmdPromote(state, args) {
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
  const dir = ensureWorkingClone(state, pin);
  assertBranchFresh(state, pin, dir);
  commitIfDirty(dir, `giterloper: promote ${pin.branch}`);
  pushBranchOrFail(dir, pin, "promote");
  const newSha = run("git", ["-C", dir, "rev-parse", "HEAD"]);
  updatePinSha(state, pin.name, newSha);
  removeStagedDir(state, pin.name, pin.branch);
  commandOutput({ promoted: true, pin: pin.name, oldSha: pin.sha, newSha, branch: pin.branch }, state.globalJson);
}

function cmdStageCleanup(state, args) {
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

function cmdVerify(state, args) {
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

function cmdAddLike(state, args, mode) {
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
  const dir = ensureWorkingClone(state, pin);
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
  updatePinSha(state, pin.name, newSha);
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

function cmdAdd(state, args) {
  return cmdAddLike(state, args, "add");
}

function cmdSubtract(state, args) {
  return cmdAddLike(state, args, "subtract");
}

function cmdReconcile(state, args) {
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
  const dir = ensureWorkingClone(state, pin);
  assertBranchFresh(state, pin, dir);

  let chunkDocument;
  try {
    ({ chunkDocument } = require("@tobilu/qmd/dist/store.js"));
  } catch (error) {
    fail(`failed to load QMD chunking module: ${error?.message || error}`, EXIT.EXTERNAL);
  }

  const processQueue = (queueName) => {
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
    updatePinSha(state, pin.name, newSha);
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

function cmdMerge(state, args) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl merge <source-pin> <target-pin>", "Merges one branched pin into another branched pin."].join("\n")
  );
  if (args.length !== 2) fail("usage: gl merge <source-pin> <target-pin>", EXIT.USER);
  const source = resolvePin(state, args[0]);
  const target = resolvePin(state, args[1]);
  requirePinBranch(source, "merge");
  requirePinBranch(target, "merge");

  const dir = ensureWorkingClone(state, target);
  assertBranchFresh(state, target, dir);
  const remoteName = `glsrc_${safeName(source.name)}`;
  const remotes = run("git", ["-C", dir, "remote"]).split(/\r?\n/).filter(Boolean);
  if (!remotes.includes(remoteName)) {
    run("git", ["-C", dir, "remote", "add", remoteName, toRemoteUrl(source.source)]);
  } else {
    run("git", ["-C", dir, "remote", "set-url", remoteName, toRemoteUrl(source.source)]);
  }
  run("git", ["-C", dir, "fetch", remoteName, source.branch, "--depth", "1"]);
  const merge = runSoft("git", [
    "-C",
    dir,
    "merge",
    `${remoteName}/${source.branch}`,
    "--no-edit",
    "-m",
    `gl: merge ${source.name} into ${target.name}`,
  ]);
  if (!merge.ok) {
    const conflicts = runSoft("git", ["-C", dir, "diff", "--name-only", "--diff-filter=U"])
      .stdout.split(/\r?\n/)
      .filter(Boolean)
      .map((f) => `  - ${f}`)
      .join("\n");
    fail(
      [
        `merge conflict merging "${source.name}" (branch "${source.branch}") into "${target.name}" (branch "${target.branch}").`,
        "Conflicting files:",
        conflicts || "  - (unable to determine)",
        "The working clone is left in a conflicted state at:",
        `  ${stagedDir(state, target.name, target.branch)}`,
        `To resolve: fix conflicts, then run "gl promote --pin ${target.name}".`,
        `To abort: run "git -C ${stagedDir(state, target.name, target.branch)} merge --abort" or "gl stage-cleanup --pin ${target.name}".`,
      ].join("\n"),
      EXIT.STATE
    );
  }
  pushBranchOrFail(dir, target, "merge");
  const newSha = run("git", ["-C", dir, "rev-parse", "HEAD"]);
  updatePinSha(state, target.name, newSha);
  commandOutput(
    {
      action: "merged",
      source: { pin: source.name, branch: source.branch, sha: source.sha },
      target: { pin: target.name, branch: target.branch, oldSha: target.sha, newSha },
    },
    state.globalJson
  );
}

function main() {
  let args = process.argv.slice(2);
  const helpJsonParsed = consumeBooleanFlag(args, "--json");
  args = helpJsonParsed.args;
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printTopHelp();
    return;
  }
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
  };
  process.env.XDG_CONFIG_HOME = path.join(state.rootDir, "qmd", "config");
  process.env.XDG_CACHE_HOME = path.join(state.rootDir, "qmd", "cache");
  state.globalJson = helpJsonParsed.found;
  const localConfig = readLocalConfig(state);
  state.gpuMode = localConfig.gpuMode || null;
  if (state.gpuMode === "cpu") {
    process.env.NODE_LLAMA_CPP_GPU = "false";
  }

  const [cmd, ...rest] = args;

  if (cmd === "status") return cmdStatus(state, rest);
  if (cmd === "pin") {
    if (rest.length === 0) fail("usage: gl pin <list|add|remove|update>", EXIT.USER);
    const [sub, ...subArgs] = rest;
    if (sub === "list") return cmdPinList(state, subArgs);
    if (sub === "add") return cmdPinAdd(state, subArgs);
    if (sub === "remove") return cmdPinRemove(state, subArgs);
    if (sub === "update") return cmdPinUpdate(state, subArgs);
    fail(`unknown pin subcommand "${sub}"`, EXIT.USER);
  }
  if (cmd === "gpu") return cmdGpu(state, rest);
  if (cmd === "clone") return cmdClone(state, rest);
  if (cmd === "index") return cmdIndex(state, rest);
  if (cmd === "teardown") return cmdTeardown(state, rest);
  if (cmd === "search") return cmdSearchLike(state, "search", rest);
  if (cmd === "query") return cmdSearchLike(state, "query", rest);
  if (cmd === "get") return cmdGet(state, rest);
  if (cmd === "stage") return cmdStage(state, rest);
  if (cmd === "promote") return cmdPromote(state, rest);
  if (cmd === "stage-cleanup") return cmdStageCleanup(state, rest);
  if (cmd === "add") return cmdAdd(state, rest);
  if (cmd === "subtract") return cmdSubtract(state, rest);
  if (cmd === "reconcile") return cmdReconcile(state, rest);
  if (cmd === "merge") return cmdMerge(state, rest);
  if (cmd === "verify") return cmdVerify(state, rest);

  fail(`unknown command "${cmd}". Run "gl --help".`, EXIT.USER);
}

try {
  main();
} catch (e) {
  if (e instanceof GlError) {
    console.error(`gl: ${e.message}`);
    process.exit(e.code);
  }
  console.error(`gl: unexpected error: ${e?.message ?? e}`);
  process.exit(EXIT.EXTERNAL);
}

// Keep an explicit module boundary for tooling that imports this file in tests.
export const __filename = fileURLToPath(import.meta.url);
