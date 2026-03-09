/**
 * Pin lifecycle: clone, index, teardown, updatePinSha, removeStagedDir.
 */

import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { run, runSoft } from "./run.js";
import { isBranchNotFoundError } from "./run.js";
import { fail } from "./errors.js";
import { EXIT } from "./errors.js";
import { cloneDir, ensureDir, stagedDir } from "./paths.js";
import { readPins, mutatePins } from "./pinned.js";
import { toRemoteUrl, verifyCloneAtSha } from "./git.js";
import {
  collectionName,
  indexName,
  pinQmd,
  collectionExists,
  contextExists,
  needsEmbeddingCount,
  assertCollectionHealthy,
  cleanupQmdFiles,
} from "./qmd.js";
import { withFifoLock } from "./locking.js";
import { ensureGpuConfig } from "./gpu.js";
import type { GlState, Pin } from "./types.js";

function log(message: string): void {
  console.error(`gl: ${message}`);
}

export interface ClonePinOptions {
  branch?: string;
  fallbackRef?: string;
}

export function clonePin(state: GlState, pin: Pin, opts: ClonePinOptions = {}): void {
  const cdir = cloneDir(state, pin);
  if (existsSync(cdir) && verifyCloneAtSha(pin, cdir)) {
    log(`clone already exists for ${collectionName(pin)}`);
    return;
  }
  ensureDir(path.dirname(cdir));
  if (existsSync(cdir)) rmSync(cdir, { recursive: true, force: true });
  const branch = opts.branch ?? pin.branch;
  const fallbackRef = opts.fallbackRef;
  const url = toRemoteUrl(pin.source);

  if (branch) {
    const result = runSoft("git", ["clone", "--depth", "1", "--branch", branch, url, cdir]);
    if (!result.ok) {
      if (isBranchNotFoundError(result)) {
        if (existsSync(cdir)) rmSync(cdir, { recursive: true, force: true });
        log(`branch "${branch}" not found; cloning from ${fallbackRef ?? "default"} and checking out ${pin.sha}`);
        if (fallbackRef && fallbackRef !== branch) {
          run("git", ["clone", "--depth", "1", "--branch", fallbackRef, url, cdir]);
        } else {
          run("git", ["clone", "--depth", "1", url, cdir]);
        }
      } else {
        fail(`git clone failed: ${(result.stderr || result.stdout).trim()}`, EXIT.EXTERNAL);
      }
    }
  } else {
    run("git", ["clone", "--depth", "1", url, cdir]);
  }
  run("git", ["-C", cdir, "checkout", pin.sha]);
  if (!verifyCloneAtSha(pin, cdir)) {
    fail(`cloned repository at ${cdir} is not at expected SHA ${pin.sha}`, EXIT.STATE);
  }
}

export function indexPin(state: GlState, pin: Pin): void {
  const cdir = cloneDir(state, pin);
  if (!existsSync(cdir)) fail(`clone missing: ${cdir}`, EXIT.STATE);
  const knowledge = path.join(cdir, "knowledge");
  if (!existsSync(knowledge)) fail(`knowledge directory missing: ${knowledge}`, EXIT.STATE);
  const collection = collectionName(pin);
  if (!collectionExists(pin, collection)) {
    run("qmd", pinQmd(pin, ["collection", "add", knowledge, "--name", collection, "--mask", "**/*.md"]));
  } else {
    log(`collection ${collection} already exists`);
  }
  if (!contextExists(pin, collection)) {
    run("qmd", pinQmd(pin, ["context", "add", `qmd://${collection}`, `${pin.name} at ${pin.sha}`]));
  }
  const needsEmbed = needsEmbeddingCount(state, pin);
  if (needsEmbed === 0) {
    log(`collection ${collection} already fully embedded, skipping qmd embed`);
  } else {
    const embedLockDir = path.join(state.rootDir, "locks", "embed");
    withFifoLock(embedLockDir, () => run("qmd", pinQmd(pin, ["embed"])), { maxWaitMs: 300000 });
  }
  assertCollectionHealthy(pin, collection);
}

export function teardownPinData(state: GlState, pin: Pin): void {
  const collection = collectionName(pin);
  runSoft("qmd", pinQmd(pin, ["context", "rm", `qmd://${collection}`]));
  runSoft("qmd", pinQmd(pin, ["collection", "remove", collection]));
  cleanupQmdFiles(state, pin);
  const cdir = cloneDir(state, pin);
  if (existsSync(cdir)) rmSync(cdir, { recursive: true, force: true });
  runSoft("rmdir", [path.join(state.versionsDir, pin.name)]);
}

export function removeStagedDir(state: GlState, pinName: string, branch: string | undefined): void {
  if (!branch) return;
  const dir = stagedDir(state, pinName, branch);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  runSoft("rmdir", [path.join(state.stagedRoot, pinName)]);
}

export interface UpdatePinShaOptions {
  branch?: string;
}

export function updatePinSha(
  state: GlState,
  pinName: string,
  newSha: string,
  opts: UpdatePinShaOptions = {}
): void {
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
