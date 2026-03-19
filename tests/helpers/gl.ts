import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Random CLI session id (valid for `validateSessionId`). Use one per test file so parallel `deno test` does not contend on `_cli`. */
export function newTestCliSessionId(): string {
  return `e2e_${randomBytes(16).toString("hex")}`;
}

/** `.giterloper/sessions/<sessionId>` under cwd (for assertions and path checks). */
export function giterloperSessionRoot(cwd: string, sessionId: string): string {
  return path.join(cwd, ".giterloper", "sessions", sessionId);
}

export type GlCliRunOpts = {
  sessionId: string;
  parseJson?: boolean;
  cwd?: string;
  stdin?: string | null;
};
const GL_SCRIPT = path.join(root, ".cursor", "skills", "gl", "scripts", "gl");
const GL_MAINTENANCE_SCRIPT = path.join(root, "scripts", "gl-maintenance");

/** Block the isolate for `ms` (for sync retry backoff in tests). */
function sleepSyncMs(ms: number): void {
  const buf = new SharedArrayBuffer(4);
  const arr = new Int32Array(buf);
  Atomics.wait(arr, 0, 0, ms);
}

/** Transient failures from shared remote, git, or subprocess cwd (see lib/run.ts defaultSpawnCwd). */
const REMOTE_TRANSIENT =
  /could not reach remote|getcwd\(\) failed|unable to get current working directory|the remote may be unreachable|try again later|rate limit/i;

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
  const parseJson = opts.parseJson ?? true;
  const cliArgs = ["--json", "--session-id", opts.sessionId, ...args];
  const cwd = opts.cwd ?? root;
  const env = { ...Deno.env.toObject() };
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let result;
    if (opts.stdin != null && opts.stdin !== "") {
      const tmp = mkdtempSync(path.join(tmpdir(), "gl-stdin-"));
      const stdinFile = path.join(tmp, "stdin.txt");
      try {
        writeFileSync(stdinFile, opts.stdin, "utf8");
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
      sleepSyncMs(2000);
      continue;
    }
    throw new Error(detail);
  }
  throw new Error("gl: unreachable retry loop exit");
}

export function runGlJson(
  args: string[],
  opts: { sessionId: string; cwd?: string; stdin?: string | null }
): unknown {
  return runGl(args, { ...opts, parseJson: true }).data;
}

/** Run gl-maintenance commands (status, verify, clone, teardown, stage, stage-cleanup, promote). */
export function runGlMaintenance(args: string[], opts: GlCliRunOpts) {
  const parseJson = opts.parseJson ?? true;
  const sessionArgs = ["--session-id", opts.sessionId];
  const cliArgs = parseJson ? ["--json", ...sessionArgs, ...args] : [...sessionArgs, ...args];
  const cwd = opts.cwd ?? root;
  const env = { ...Deno.env.toObject() };
  const maxAttempts = 3;

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
      sleepSyncMs(2000);
      continue;
    }
    throw new Error(detail);
  }
  throw new Error("gl-maintenance: unreachable retry loop exit");
}

export function runGlMaintenanceJson(
  args: string[],
  opts: { sessionId: string; cwd?: string }
): unknown {
  return runGlMaintenance(args, { ...opts, parseJson: true }).data;
}
