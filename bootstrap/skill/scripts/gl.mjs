#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXIT = {
  OK: 0,
  USER: 1,
  STATE: 2,
  EXTERNAL: 3,
};

function fail(message, code = EXIT.USER) {
  console.error(`gl: ${message}`);
  process.exit(code);
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
    fail(
      `missing ${state.rootDir}. Run "gl init" first or move to a git project configured for giterloper.`,
      EXIT.STATE
    );
  }
  if (!existsSync(state.pinnedPath)) {
    fail(`missing ${state.pinnedPath}. Run "gl init" first.`, EXIT.STATE);
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
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    const at = value.lastIndexOf("@");
    if (!name || at < 0) {
      fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
    }
    const source = value.slice(0, at).trim();
    const sha = value.slice(at + 1).trim();
    if (!source || !/^[0-9a-f]{40}$/i.test(sha)) {
      fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
    }
    pins.push({ name, source, sha });
  }
  return pins;
}

function serializePins(pins) {
  const body = pins.map((pin) => `${pin.name}: ${pin.source}@${pin.sha}`).join("\n");
  return `${body}${body ? "\n" : ""}`;
}

function readPins(state) {
  ensureGiterloperRoot(state);
  const content = readFileSync(state.pinnedPath, "utf8");
  return parsePinned(content);
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

function cloneDir(state, pin) {
  return path.join(state.versionsDir, pin.name, pin.sha);
}

function stagedDir(state, pinName, branchName) {
  return path.join(state.stagedRoot, pinName, branchName);
}

function collectionExists(collection) {
  const out = run("qmd", ["collection", "list"]);
  return out.includes(collection);
}

function contextExists(collection) {
  const out = run("qmd", ["context", "list"]);
  return out.includes(`qmd://${collection}`);
}

function verifyCloneAtSha(pin, clonePath) {
  if (!existsSync(clonePath)) return false;
  const head = run("git", ["-C", clonePath, "rev-parse", "HEAD"]).toLowerCase();
  return head === pin.sha.toLowerCase();
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

function assertCollectionHealthy(collection) {
  const status = run("qmd", ["status"]);
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

function printTopHelp() {
  commandOutput(
    [
      "gl - giterloper CLI",
      "",
      "Usage:",
      "  gl <command> [subcommand] [options]",
      "",
      "Commands:",
      "  init",
      "  status",
      "  gpu [--cpu]",
      "  pin list|add|remove|update",
      "  clone [--pin <name>|--all]",
      "  index [--pin <name>|--all]",
      "  setup <name> <source> [--ref <ref>]",
      "  teardown <name>",
      "  search <query> [--pin <name>] [-n N] [--json]",
      "  query <question> [--pin <name>] [--json]",
      "  get <path> [--pin <name>] [--full] [--json]",
      "  stage <branch> [--pin <name>]",
      "  promote <branch> [--pin <name>]",
      "  stage-cleanup <branch> [--pin <name>]",
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

function cmdInit(state, args) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl init",
      "Creates .giterloper/ and required files.",
      "Ensures .gitignore includes .giterloper/versions/ and .giterloper/staged/.",
    ].join("\n")
  );
  ensureDir(state.rootDir);
  ensureDir(state.versionsDir);
  ensureDir(state.stagedRoot);
  if (!existsSync(state.pinnedPath)) {
    writeFileSync(state.pinnedPath, "", "utf8");
    info(`created ${state.pinnedPath}`);
  }
  ensureGitignoreEntries(state);
  commandOutput({ ok: true, root: state.rootDir, pinned: state.pinnedPath }, state.globalJson);
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
    return {
      ...pin,
      clonePath: cdir,
      cloneExists: existsSync(cdir),
      cloneAtExpectedSha: existsSync(cdir) ? verifyCloneAtSha(pin, cdir) : false,
      collection,
      collectionExists: collectionExists(collection),
      contextExists: contextExists(collection),
    };
  });
  const qmd = runSoft("qmd", ["status"]);
  const out = {
    projectRoot: state.projectRoot,
    giterloperRoot: state.rootDir,
    pinnedPath: state.pinnedPath,
    pins: pinStates,
    qmd: qmd.ok ? qmd.stdout : qmd.stderr || "qmd status failed",
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
      : pins.map((pin, idx) => `${idx === 0 ? "*" : " "} ${pin.name}: ${pin.source}@${pin.sha}`).join("\n"),
    state.globalJson
  );
}

function cmdPinAdd(state, args) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl pin add <name> <source> [--ref <ref>]",
      "Adds or replaces a pin entry. Resolves source+ref to a full SHA.",
    ].join("\n")
  );
  if (args.length < 2) fail("usage: gl pin add <name> <source> [--ref <ref>]", EXIT.USER);
  const name = args[0];
  const source = args[1];
  let rest = args.slice(2);
  const refParsed = parseFlag(rest, "--ref");
  rest = refParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const ref = refParsed.found ? refParsed.value : "HEAD";
  const sha = resolveSha(source, ref);
  const pins = readPins(state).filter((p) => p.name !== name);
  pins.unshift({ name, source, sha });
  writePinsAtomic(state, pins);
  commandOutput({ name, source, ref, sha, action: "pin-added" }, state.globalJson);
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
  const collection = collectionName(target);
  if (contextExists(collection)) runSoft("qmd", ["context", "rm", `qmd://${collection}`]);
  if (collectionExists(collection)) runSoft("qmd", ["collection", "remove", collection]);
  const cdir = cloneDir(state, target);
  if (existsSync(cdir)) rmSync(cdir, { recursive: true, force: true });
  const parent = path.join(state.versionsDir, name);
  runSoft("rmdir", [parent]);
  const updated = pins.filter((p) => p.name !== name);
  writePinsAtomic(state, updated);
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
  const ref = refParsed.found ? refParsed.value : "HEAD";
  const newSha = resolveSha(oldPin.source, ref);
  if (newSha.toLowerCase() === oldPin.sha.toLowerCase()) {
    commandOutput({ name, sha: newSha, updated: false, reason: "already at requested sha" }, state.globalJson);
    return;
  }
  const newPin = { ...oldPin, sha: newSha };
  clonePin(state, newPin);
  ensureGpuConfig(state);
  indexPin(state, newPin);
  teardownPinData(state, oldPin);
  const updated = pins.filter((p) => p.name !== name);
  updated.unshift(newPin);
  writePinsAtomic(state, updated);
  commandOutput({ name, oldSha: oldPin.sha, newSha, updated: true }, state.globalJson);
}

function clonePin(state, pin) {
  const cdir = cloneDir(state, pin);
  if (existsSync(cdir) && verifyCloneAtSha(pin, cdir)) {
    info(`clone already exists for ${collectionName(pin)}`);
    return;
  }
  ensureDir(path.dirname(cdir));
  if (existsSync(cdir)) rmSync(cdir, { recursive: true, force: true });
  run("git", ["clone", "--depth", "1", toRemoteUrl(pin.source), cdir]);
  run("git", ["-C", cdir, "checkout", pin.sha]);
  if (!verifyCloneAtSha(pin, cdir)) {
    fail(`cloned repository at ${cdir} is not at expected SHA ${pin.sha}`, EXIT.STATE);
  }
}

function indexPin(state, pin) {
  const cdir = cloneDir(state, pin);
  if (!existsSync(cdir)) fail(`clone missing: ${cdir}`, EXIT.STATE);
  const knowledge = path.join(cdir, "knowledge");
  if (!existsSync(knowledge)) fail(`knowledge directory missing: ${knowledge}`, EXIT.STATE);
  const collection = collectionName(pin);
  if (!collectionExists(collection)) {
    run("qmd", ["collection", "add", knowledge, "--name", collection, "--mask", "**/*.md"]);
  } else {
    info(`collection ${collection} already exists`);
  }
  if (!contextExists(collection)) {
    run("qmd", ["context", "add", `qmd://${collection}`, `${pin.name} at ${pin.sha}`]);
  }
  run("qmd", ["embed"]);
  assertCollectionHealthy(collection);
}

function teardownPinData(state, pin) {
  const collection = collectionName(pin);
  runSoft("qmd", ["context", "rm", `qmd://${collection}`]);
  runSoft("qmd", ["collection", "remove", collection]);
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
  for (const pin of pins) clonePin(state, pin);
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

function cmdSetup(state, args) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl setup <name> <source> [--ref <ref>]",
      "Adds a pin, clones it, and indexes it with qmd.",
    ].join("\n")
  );
  if (args.length < 2) fail("usage: gl setup <name> <source> [--ref <ref>]", EXIT.USER);
  const name = args[0];
  const source = args[1];
  let rest = args.slice(2);
  const refParsed = parseFlag(rest, "--ref");
  rest = refParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  if (!existsSync(state.rootDir)) cmdInit(state, []);
  const ref = refParsed.found ? refParsed.value : "HEAD";
  const sha = resolveSha(source, ref);
  const pins = readPins(state).filter((p) => p.name !== name);
  const pin = { name, source, sha };
  pins.unshift(pin);
  writePinsAtomic(state, pins);
  clonePin(state, pin);
  ensureGpuConfig(state);
  indexPin(state, pin);
  commandOutput({ setup: true, pin }, state.globalJson);
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
  const out = run("qmd", cmdArgs);
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
  const out = run("qmd", cmdArgs);
  commandOutput(out);
}

function cmdStage(state, args) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl stage <branch> [--pin <name>]", "Creates staged working clone on a new branch."].join("\n")
  );
  if (args.length < 1) fail("usage: gl stage <branch> [--pin <name>]", EXIT.USER);
  const branch = args[0];
  let rest = args.slice(1);
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pin = resolvePin(state, pinParsed.found ? pinParsed.value : null);
  const dir = stagedDir(state, pin.name, branch);
  if (existsSync(dir)) {
    commandOutput({ staged: dir, branch, pin: pin.name, created: false }, state.globalJson);
    return;
  }
  ensureDir(path.dirname(dir));
  run("git", ["clone", "--depth", "1", toRemoteUrl(pin.source), dir]);
  run("git", ["-C", dir, "checkout", "-b", branch]);
  commandOutput({ staged: dir, branch, pin: pin.name, created: true }, state.globalJson);
}

function cmdPromote(state, args) {
  ensureHelpNotRequested(
    args,
    [
      "Usage: gl promote <branch> [--pin <name>]",
      "Commits staged clone (if dirty), pushes branch, clones/indexes new SHA, updates pin.",
    ].join("\n")
  );
  if (args.length < 1) fail("usage: gl promote <branch> [--pin <name>]", EXIT.USER);
  const branch = args[0];
  let rest = args.slice(1);
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pin = resolvePin(state, pinParsed.found ? pinParsed.value : null);
  const dir = stagedDir(state, pin.name, branch);
  if (!existsSync(dir)) fail(`staged clone not found: ${dir}. Run "gl stage ${branch}" first.`, EXIT.STATE);
  const status = run("git", ["-C", dir, "status", "--porcelain"]);
  if (status) {
    run("git", ["-C", dir, "add", "-A"]);
    run("git", ["-C", dir, "commit", "-m", `giterloper: promote ${branch}`]);
  }
  run("git", ["-C", dir, "push", "-u", "origin", branch]);
  const newSha = run("git", ["-C", dir, "rev-parse", "HEAD"]);
  const newPin = { ...pin, sha: newSha };
  clonePin(state, newPin);
  ensureGpuConfig(state);
  indexPin(state, newPin);
  teardownPinData(state, pin);
  const pins = readPins(state).filter((p) => p.name !== pin.name);
  pins.unshift(newPin);
  writePinsAtomic(state, pins);
  rmSync(dir, { recursive: true, force: true });
  runSoft("rmdir", [path.join(state.stagedRoot, pin.name)]);
  commandOutput({ promoted: true, pin: pin.name, oldSha: pin.sha, newSha, branch }, state.globalJson);
}

function cmdStageCleanup(state, args) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl stage-cleanup <branch> [--pin <name>]", "Deletes staged clone without promoting."].join("\n")
  );
  if (args.length < 1) fail("usage: gl stage-cleanup <branch> [--pin <name>]", EXIT.USER);
  const branch = args[0];
  let rest = args.slice(1);
  const pinParsed = parseFlag(rest, "--pin");
  rest = pinParsed.args;
  if (rest.length > 0) fail(`unexpected arguments: ${rest.join(" ")}`, EXIT.USER);
  const pin = resolvePin(state, pinParsed.found ? pinParsed.value : null);
  const dir = stagedDir(state, pin.name, branch);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    runSoft("rmdir", [path.join(state.stagedRoot, pin.name)]);
  }
  commandOutput({ cleaned: true, path: dir }, state.globalJson);
}

function cmdVerify(state, args) {
  ensureHelpNotRequested(
    args,
    ["Usage: gl verify [--pin <name>] [--json]", "Verifies pin, clone, collection, and vector health."].join("\n")
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
    const collectionPresent = collectionExists(collection);
    const contextPresent = contextExists(collection);
    let vectorsOk = false;
    if (collectionPresent) {
      const status = runSoft("qmd", ["status"]);
      if (status.ok) {
        const statusText = status.stdout.toLowerCase();
        vectorsOk = statusText.includes(collection.toLowerCase()) && !statusText.includes("vectors: 0");
      }
    }
    results.push({
      pin: pin.name,
      sha: pin.sha,
      clonePath: cdir,
      clonePresent,
      cloneShaOk,
      collection,
      collectionPresent,
      contextPresent,
      vectorsOk,
      ok: clonePresent && cloneShaOk && collectionPresent && contextPresent && vectorsOk,
    });
  }
  const allOk = results.every((r) => r.ok);
  commandOutput({ ok: allOk, checks: results }, state.globalJson);
  if (!allOk) process.exit(EXIT.STATE);
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
  state.globalJson = helpJsonParsed.found;
  const localConfig = readLocalConfig(state);
  state.gpuMode = localConfig.gpuMode || null;
  if (state.gpuMode === "cpu") {
    process.env.NODE_LLAMA_CPP_GPU = "false";
  }

  const [cmd, ...rest] = args;

  if (cmd === "init") return cmdInit(state, rest);
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
  if (cmd === "setup") return cmdSetup(state, rest);
  if (cmd === "teardown") return cmdTeardown(state, rest);
  if (cmd === "search") return cmdSearchLike(state, "search", rest);
  if (cmd === "query") return cmdSearchLike(state, "query", rest);
  if (cmd === "get") return cmdGet(state, rest);
  if (cmd === "stage") return cmdStage(state, rest);
  if (cmd === "promote") return cmdPromote(state, rest);
  if (cmd === "stage-cleanup") return cmdStageCleanup(state, rest);
  if (cmd === "verify") return cmdVerify(state, rest);

  fail(`unknown command "${cmd}". Run "gl --help".`, EXIT.USER);
}

main();

// Keep an explicit module boundary for tooling that imports this file in tests.
export const __filename = fileURLToPath(import.meta.url);
