/**
 * Pin lifecycle: clonePin, teardownPinData, updatePinSha, removeStagedDir.
 */
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

import { EXIT, fail } from "./errors.ts";
import { run, runSoft } from "./run.ts";
import { toRemoteUrl } from "./git.ts";
import { cloneDir, ensureDir, stagedDir } from "./paths.ts";
import { mutatePins, readPins } from "./pinned.ts";
import type { GlState } from "./types.ts";
import type { Pin } from "./types.ts";

export function verifyCloneAtSha(pin: Pin, clonePath: string): boolean {
  if (!existsSync(clonePath)) return false;
  const result = runSoft("git", ["-C", clonePath, "rev-parse", "HEAD"]);
  if (!result.ok || !result.stdout) return false;
  return result.stdout.trim().toLowerCase() === pin.sha.toLowerCase();
}

export function removeStagedDir(
  state: GlState,
  pinName: string,
  branch: string | undefined
): void {
  if (!branch) return;
  const dir = stagedDir(state, pinName, branch);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  runSoft("rmdir", [path.join(state.stagedRoot, pinName)]);
}

export interface ClonePinOpts {
  infoFn?: (msg: string) => void;
}

/** Clone directly from the pin's SHA. Branch is never used for cloning. */
export function clonePin(
  state: GlState,
  pin: Pin,
  opts: ClonePinOpts = {}
): void {
  const cdir = cloneDir(state, pin);
  if (existsSync(cdir) && verifyCloneAtSha(pin, cdir)) {
    (opts.infoFn ?? (() => {}))(`clone already exists for ${pin.name}@${pin.sha}`);
    return;
  }
  ensureDir(path.dirname(cdir));
  if (existsSync(cdir)) rmSync(cdir, { recursive: true, force: true });
  const url = toRemoteUrl(pin.source);

  // Clone from SHA: init, fetch the commit, checkout. No branch involved.
  run("git", ["init", cdir]);
  run("git", ["-C", cdir, "remote", "add", "origin", url]);
  const fetchResult = runSoft("git", [
    "-C",
    cdir,
    "fetch",
    "--depth",
    "1",
    "origin",
    `${pin.sha}:refs/heads/_pin`,
  ]);
  if (!fetchResult.ok) {
    fail(
      `git fetch ${pin.sha} failed: ${(fetchResult.stderr || fetchResult.stdout).trim()}. ` +
        "The commit may not exist on the remote or the server may not allow fetch-by-SHA.",
      EXIT.EXTERNAL
    );
  }
  run("git", ["-C", cdir, "checkout", pin.sha]);
  if (!verifyCloneAtSha(pin, cdir)) {
    fail(
      `cloned repository at ${cdir} is not at expected SHA ${pin.sha}`,
      EXIT.STATE
    );
  }
}

export function teardownPinData(state: GlState, pin: Pin): void {
  const cdir = cloneDir(state, pin);
  if (existsSync(cdir)) rmSync(cdir, { recursive: true, force: true });
  runSoft("rmdir", [path.join(state.versionsDir, pin.name)]);
}

export interface UpdatePinShaOpts {
  infoFn?: (msg: string) => void;
}

export function updatePinSha(
  state: GlState,
  pinName: string,
  newSha: string,
  opts: UpdatePinShaOpts = {}
): void {
  const pins = readPins(state);
  const target = pins.find((p) => p.name === pinName);
  if (!target) fail(`pin "${pinName}" not found`, EXIT.USER);
  const oldPin = { ...target };
  const newPin = { ...target, sha: newSha };

  try {
    clonePin(state, newPin, { infoFn: opts.infoFn });
    teardownPinData(state, oldPin);
  } catch (e) {
    teardownPinData(state, newPin);
    throw e;
  }

  mutatePins(state, (pins) => {
    const updated = pins.filter((p) => p.name !== pinName);
    updated.unshift(newPin);
    return updated;
  });
}
