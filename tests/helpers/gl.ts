import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { TestRuntimeContext } from "./test-runtime-context.ts";

export type { TestRuntimeContext } from "./test-runtime-context.ts";
export {
  createTestRuntimeContext,
  destroyTestRuntimeContext,
  newTestCliSessionId,
  scratchPinName,
} from "./test-runtime-context.ts";

/** Repository root (workspace); use for reading fixture files when `Deno.cwd()` is a per-test temp dir. */
export const GITERLOPER_REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const GL_SCRIPT = path.join(GITERLOPER_REPO_ROOT, ".cursor", "skills", "gl", "scripts", "gl");
const GL_MAINTENANCE_SCRIPT = path.join(GITERLOPER_REPO_ROOT, "scripts", "gl-maintenance");

/** Session state directory under `cwd`: `.giterloper/<sessionId>/` (see `tests/README.md`). */
export function giterloperSessionRoot(cwd: string, sessionId: string): string {
  return path.join(cwd, ".giterloper", sessionId);
}

type GlCliRunOptsBase = {
  parseJson?: boolean;
  stdin?: string | null;
};

/**
 * CLI / gl-maintenance subprocess opts: pass `ctx` or explicit `cwd` + `sessionId`.
 * Integration helpers do not default `cwd` to the repo root (avoids shared `.giterloper` contention).
 */
export type GlCliRunOpts = GlCliRunOptsBase &
  ({ ctx: TestRuntimeContext } | { cwd: string; sessionId: string });

function resolveGlRun(
  opts: GlCliRunOpts
): { cwd: string; sessionId: string; parseJson: boolean; stdin: string | null | undefined } {
  const cwd = "ctx" in opts ? opts.ctx.cwd : opts.cwd;
  const sessionId = "ctx" in opts ? opts.ctx.sessionId : opts.sessionId;
  return {
    cwd,
    sessionId,
    parseJson: opts.parseJson ?? true,
    stdin: opts.stdin,
  };
}

/** Block the isolate for `ms` (for sync retry backoff in tests). */
function sleepSyncMs(ms: number): void {
  const buf = new SharedArrayBuffer(4);
  const arr = new Int32Array(buf);
  Atomics.wait(arr, 0, 0, ms);
}

/** Transient failures from shared remote, git, or subprocess cwd (see lib/run.ts defaultSpawnCwd). */
const REMOTE_TRANSIENT =
  /could not reach remote|getcwd\(\) failed|unable to get current working directory|the remote may be unreachable|try again later|rate limit|SSL connection timeout|unable to access|Connection timed out|Could not resolve host|Recv failure|Operation timed out|the remote end hung up unexpectedly|ENOBUFS/i;

function normalizeOutput(stdout: string, parseJson: boolean): unknown {
  if (!stdout) return null;
  const text = stdout.trim();
  if (!parseJson) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function runGl(args: string[], opts: GlCliRunOpts) {
  const { cwd, sessionId, parseJson, stdin } = resolveGlRun(opts);
  const cliArgs = ["--json", "--session-id", sessionId, ...args];
  const env = { ...Deno.env.toObject() };
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let result;
    if (stdin != null && stdin !== "") {
      const tmp = mkdtempSync(path.join(tmpdir(), "gl-stdin-"));
      const stdinFile = path.join(tmp, "stdin.txt");
      try {
        writeFileSync(stdinFile, stdin, "utf8");
        result = spawnSync("sh", ["-c", `"${GL_SCRIPT}" ${cliArgs.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")} < ${stdinFile}`], {
          cwd,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          env,
        });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    } else {
      result = spawnSync(GL_SCRIPT, cliArgs, {
        cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        env,
      });
    }

    if (result.error) {
      throw new Error(`Failed to launch gl: ${result.error.message}`);
    }

    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    if (result.status === 0) {
      return {
        status: result.status,
        stdout,
        stderr,
        data: normalizeOutput(stdout, parseJson),
      };
    }

    const detail = (stderr || stdout || "gl command failed").trim();
    if (attempt < maxAttempts - 1 && REMOTE_TRANSIENT.test(detail)) {
      sleepSyncMs(2000 * (attempt + 1));
      continue;
    }
    throw new Error(detail);
  }
  throw new Error("gl: unreachable retry loop exit");
}

export function runGlJson(args: string[], opts: GlCliRunOpts): unknown {
  return runGl(args, { ...opts, parseJson: true }).data;
}

/** Run gl-maintenance commands (status, verify, clone, teardown, stage, stage-cleanup, promote). */
export function runGlMaintenance(args: string[], opts: GlCliRunOpts) {
  const { cwd, sessionId, parseJson } = resolveGlRun(opts);
  const sessionArgs = ["--session-id", sessionId];
  const cliArgs = parseJson ? ["--json", ...sessionArgs, ...args] : [...sessionArgs, ...args];
  const env = { ...Deno.env.toObject() };
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = spawnSync(GL_MAINTENANCE_SCRIPT, cliArgs, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    if (result.error) {
      throw new Error(`Failed to launch gl-maintenance: ${result.error.message}`);
    }

    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    if (result.status === 0) {
      return {
        status: result.status,
        stdout,
        stderr,
        data: normalizeOutput(stdout, parseJson),
      };
    }

    const detail = (stderr || stdout || "gl-maintenance command failed").trim();
    if (attempt < maxAttempts - 1 && REMOTE_TRANSIENT.test(detail)) {
      sleepSyncMs(2000 * (attempt + 1));
      continue;
    }
    throw new Error(detail);
  }
  throw new Error("gl-maintenance: unreachable retry loop exit");
}

export function runGlMaintenanceJson(args: string[], opts: GlCliRunOpts): unknown {
  return runGlMaintenance(args, { ...opts, parseJson: true }).data;
}
