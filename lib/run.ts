/**
 * Process execution: run, runSoft, isBranchNotFoundError.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { EXIT, fail } from "./errors.ts";
import type { RunResult } from "./types.ts";

/** Default cwd for child processes when the caller omits one. Avoids `getcwd() failed` if the process cwd was deleted. */
function defaultSpawnCwd(): string {
  try {
    const dir = Deno.cwd();
    if (existsSync(dir)) return dir;
  } catch {
    /* Deno.cwd() can throw when cwd no longer exists */
  }
  return "/";
}

const DEFAULT_SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string>; maxBuffer?: number } = {}
): string {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: opts.maxBuffer ?? DEFAULT_SPAWN_MAX_BUFFER,
    cwd: opts.cwd ?? defaultSpawnCwd(),
    env: opts.env,
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
  return (result.stdout || "").trim();
}

export function runSoft(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string>; maxBuffer?: number } = {}
): RunResult {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: opts.maxBuffer ?? DEFAULT_SPAWN_MAX_BUFFER,
    cwd: opts.cwd ?? defaultSpawnCwd(),
    env: opts.env,
  });
  return {
    ok: !result.error && result.status === 0,
    status: result.status ?? 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error,
  };
}

export function isBranchNotFoundError(r: RunResult): boolean {
  if (r.ok) return false;
  const msg = (r.stderr + "\n" + r.stdout).toLowerCase();
  return (
    (msg.includes("remote branch") && msg.includes("not found")) ||
    msg.includes("could not find remote branch") ||
    (msg.includes("pathspec") && msg.includes("did not match"))
  );
}

/** True if the error suggests a missing object (e.g. shallow clone lacks commit/tree). */
export function isMissingObjectError(r: RunResult): boolean {
  if (r.ok) return false;
  const msg = (r.stderr + "\n" + r.stdout).toLowerCase();
  return (
    msg.includes("unable to read tree") ||
    msg.includes("reference is not a tree") ||
    msg.includes("missing blob") ||
    msg.includes("missing commit") ||
    (msg.includes("object") && msg.includes("not found"))
  );
}
