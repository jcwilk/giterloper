import { spawnSync } from "node:child_process";

/**
 * Transient remote/network/git stderr patterns for integration tests.
 * Aligned with tests/helpers/gl.ts REMOTE_TRANSIENT; adds HTTPS/git client wording.
 */
const GIT_REMOTE_TRANSIENT =
  /could not reach remote|getcwd\(\) failed|unable to get current working directory|the remote may be unreachable|try again later|rate limit|SSL connection timeout|Connection timed out|Could not resolve host|Connection refused|Recv failure|Operation timed out|Failed to connect|unable to access|Could not read from remote repository|the remote end hung up unexpectedly|Empty reply from server|TLS handshake|ENOBUFS|errno=|upload-pack: not our ref|not our ref 0{40}/i;

function sleepSyncMs(ms: number): void {
  const buf = new SharedArrayBuffer(4);
  const arr = new Int32Array(buf);
  Atomics.wait(arr, 0, 0, ms);
}

export type RunGitOpts = {
  cwd?: string | null;
  silent?: boolean;
  /** Retries on transient remote failures (default 5). */
  maxAttempts?: number;
};

const GIT_SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

/** Run `git` with bounded retries when GitHub/network flakes under parallel load. */
export function runGit(args: string[], opts: RunGitOpts = {}): string {
  const maxAttempts = opts.maxAttempts ?? 8;
  const cwd = opts.cwd === null || opts.cwd === undefined ? undefined : opts.cwd;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = spawnSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: GIT_SPAWN_MAX_BUFFER,
      stdio: ["ignore", opts.silent ? "ignore" : "pipe", "pipe"],
    });

    if (result.error) {
      const msg = `Failed to run git: ${result.error.message}`;
      if (attempt < maxAttempts - 1 && GIT_REMOTE_TRANSIENT.test(msg)) {
        sleepSyncMs(3000 * (attempt + 1) + Math.floor(Math.random() * 500));
        continue;
      }
      throw new Error(msg);
    }

    if (result.status === 0) {
      return (result.stdout || "").trim();
    }

    const stderr = (result.stderr || result.stdout || "git command failed").trim();
    if (attempt < maxAttempts - 1 && GIT_REMOTE_TRANSIENT.test(stderr)) {
      sleepSyncMs(3000 * (attempt + 1) + Math.floor(Math.random() * 500));
      continue;
    }
    throw new Error(stderr);
  }
  throw new Error("runGit: unreachable retry exit");
}
