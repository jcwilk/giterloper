/**
 * Centralized retries for external I/O (git over network, GitHub REST).
 * Append-only log: logs/giterloper-retry.log under GITERLOPER_PROJECT_ROOT or Deno.cwd().
 */
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { isBranchNotFoundError, runSoft } from "./run.ts";
import type { GlState, RetryLogContext, RunResult } from "./types.ts";

const PROJECT_ROOT_ENV = "GITERLOPER_PROJECT_ROOT";

export function giterloperProjectRoot(): string {
  const o = Deno.env.get(PROJECT_ROOT_ENV)?.trim();
  return o && o.length > 0 ? path.resolve(o) : path.resolve(Deno.cwd());
}

export const RETRY_LOG_REL_PATH = path.join("logs", "giterloper-retry.log");

export interface RetryAttemptMeta {
  operation: string;
  attempt: number;
  maxAttempts: number;
  waitMs: number;
  errSnippet: string;
  ctx?: RetryLogContext;
}

const ERR_SNIP_MAX = 240;

function retryLogPath(): string {
  return path.join(giterloperProjectRoot(), RETRY_LOG_REL_PATH);
}

/** Append one JSON line; on failure, mirror once to stderr. */
export function logRetryAttempt(meta: RetryAttemptMeta): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    pid: Deno.pid,
    sessionId: meta.ctx?.sessionId ?? null,
    role: meta.ctx?.role ?? null,
    operation: meta.operation,
    attempt: meta.attempt,
    maxAttempts: meta.maxAttempts,
    waitMs: meta.waitMs,
    err: meta.errSnippet.slice(0, ERR_SNIP_MAX),
  });
  const full = line + "\n";
  try {
    const dir = path.dirname(retryLogPath());
    mkdirSync(dir, { recursive: true });
    appendFileSync(retryLogPath(), full, "utf8");
  } catch {
    console.error(`[giterloper retry log failed] ${line}`);
  }
}

export function computeBackoffMs(attemptIndex: number, baseMs = 800, capMs = 30_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** attemptIndex);
  const jitter = Math.floor(Math.random() * Math.min(500, exp / 4));
  return Math.min(capMs, exp + jitter);
}

/**
 * True when stderr/stdout/error text matches known transient git/network/git-client failures.
 * Consolidates patterns from tests/helpers/run-git.ts and tests/helpers/gl.ts.
 */
export function gitTransientMessage(msg: string): boolean {
  if (!msg) return false;
  const low = msg.toLowerCase();
  if (low.includes("authentication failed")) return false;
  if (low.includes("permission denied (publickey)")) return false;
  return GIT_TRANSIENT_RE.test(msg);
}

const GIT_TRANSIENT_RE =
  /could not reach remote|getcwd\(\) failed|unable to get current working directory|the remote may be unreachable|try again later|rate limit|ssl connection timeout|connection timed out|could not resolve host|recv failure|operation timed out|failed to connect|unable to access|could not read from remote repository|the remote end hung up unexpectedly|empty reply from server|tls handshake|enobufs|errno=|upload-pack: not our ref|not our ref 0{40}|connection refused|could not resolve|temporary failure|network is unreachable|broken pipe|reset by peer/i;

export function gitRunResultTransient(r: RunResult): boolean {
  if (r.ok) return false;
  if (isBranchNotFoundError(r)) return false;
  const bits = [r.stderr, r.stdout, r.error?.message ?? ""].join("\n");
  return gitTransientMessage(bits);
}

function extractGitSubcommand(args: string[]): string | null {
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === "-C" || a === "--git-dir" || a === "--work-tree") {
      i += 2;
      continue;
    }
    if (a === "-c") {
      i += 2;
      continue;
    }
    if (a.startsWith("-")) {
      i += 1;
      continue;
    }
    return a;
  }
  return null;
}

const GIT_NETWORK_SUBCOMMANDS = new Set(["ls-remote", "clone", "fetch", "pull", "push"]);

export function gitArgsTouchNetwork(args: string[]): boolean {
  const sub = extractGitSubcommand(args);
  return sub != null && GIT_NETWORK_SUBCOMMANDS.has(sub);
}

export function retryLogFromGlState(state: GlState): RetryLogContext {
  return { sessionId: state.sessionId, role: state.retryLogRole ?? "cli" };
}

export interface RunGitNetworkOpts {
  operation: string;
  logContext?: RetryLogContext;
  maxAttempts?: number;
  /** Fewer attempts / stronger backoff when true (push). */
  conservativePush?: boolean;
}

function sleepSyncMs(ms: number): void {
  const buf = new SharedArrayBuffer(4);
  const arr = new Int32Array(buf);
  Atomics.wait(arr, 0, 0, ms);
}

export function runSoftWithRetry(
  cmd: string,
  args: string[],
  spawnOpts: { cwd?: string; env?: Record<string, string> },
  options: RunGitNetworkOpts & {
    transient: (r: RunResult) => boolean;
  }
): RunResult {
  const maxAttempts = options.conservativePush
    ? Math.min(options.maxAttempts ?? 4, 4)
    : options.maxAttempts ?? 6;
  let last: RunResult = { ok: false, status: 1, stdout: "", stderr: "", error: undefined };
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = runSoft(cmd, args, spawnOpts);
    if (last.ok) return last;
    if (!options.transient(last) || attempt === maxAttempts - 1) return last;
    const base = options.conservativePush ? 1200 : 800;
    const cap = options.conservativePush ? 45_000 : 30_000;
    const waitMs = computeBackoffMs(attempt, base, cap);
    const bits = [last.stderr, last.stdout, last.error?.message ?? ""].join(" ").trim();
    logRetryAttempt({
      operation: options.operation,
      attempt: attempt + 1,
      maxAttempts,
      waitMs,
      errSnippet: bits || `exit ${last.status}`,
      ctx: options.logContext,
    });
    sleepSyncMs(waitMs);
  }
  return last;
}

/** Network git: retries transient failures; non-network git argv returns a single runSoft (no retry). */
export function runGitNetwork(
  args: string[],
  spawnOpts: { cwd?: string; env?: Record<string, string> },
  options: RunGitNetworkOpts
): RunResult {
  if (!gitArgsTouchNetwork(args)) {
    return runSoft("git", args, spawnOpts);
  }
  const isPush = extractGitSubcommand(args) === "push";
  const conservativePush = isPush || options.conservativePush === true;
  return runSoftWithRetry("git", args, spawnOpts, {
    ...options,
    conservativePush,
    transient: gitRunResultTransient,
  });
}

function parseRetryAfterMs(res: Response): number {
  const ra = res.headers.get("retry-after");
  if (!ra) return 0;
  const sec = parseInt(ra, 10);
  if (!isNaN(sec) && sec > 0) return Math.min(sec * 1000, 120_000);
  const when = Date.parse(ra);
  if (!isNaN(when)) return Math.min(Math.max(0, when - Date.now()), 120_000);
  return 0;
}

function parseRateLimitWaitMs(res: Response): number {
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (remaining !== "0") return 0;
  const reset = res.headers.get("x-ratelimit-reset");
  if (!reset) return 0;
  const epochSec = parseInt(reset, 10);
  if (isNaN(epochSec)) return 0;
  const target = epochSec * 1000;
  return Math.min(Math.max(0, target - Date.now()), 120_000);
}

export interface GithubRetryOpts {
  /** POST /merges — never retry 409 (conflict). */
  isMergePost?: boolean;
}

/**
 * Classify GitHub REST response for retry. Uses status, Retry-After, and X-RateLimit-*.
 * Caller supplies body text when already read (e.g. after await res.text()).
 */
export function githubResponseRetry(
  res: Response,
  bodyText: string,
  opts?: GithubRetryOpts
): { retry: boolean; waitMs: number } {
  const s = res.status;
  if (s >= 200 && s < 300) return { retry: false, waitMs: 0 };
  if (s === 401 || s === 422 || s === 404) return { retry: false, waitMs: 0 };
  if (s === 409 && opts?.isMergePost) return { retry: false, waitMs: 0 };

  const low = bodyText.toLowerCase();
  if (s === 403) {
    const rateish =
      low.includes("rate limit") ||
      low.includes("secondary rate") ||
      low.includes("abuse detection") ||
      res.headers.get("x-ratelimit-remaining") === "0";
    if (!rateish) return { retry: false, waitMs: 0 };
  }

  if (s === 429 || s === 403 || s >= 500) {
    const w = parseRetryAfterMs(res) || parseRateLimitWaitMs(res);
    return { retry: true, waitMs: w };
  }
  return { retry: false, waitMs: 0 };
}

export interface FetchWithRetryOpts {
  operation: string;
  retryLog?: RetryLogContext;
  maxAttempts?: number;
  isMergePost?: boolean;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit | undefined,
  options: FetchWithRetryOpts
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    const bodyText = await res.text().catch(() => "");
    const rebuilt = new Response(bodyText, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
    const { retry, waitMs } = githubResponseRetry(rebuilt, bodyText, {
      isMergePost: options.isMergePost,
    });
    if (!retry || attempt === maxAttempts - 1) return rebuilt;
    const backoff = waitMs > 0 ? waitMs : computeBackoffMs(attempt);
    logRetryAttempt({
      operation: options.operation,
      attempt: attempt + 1,
      maxAttempts,
      waitMs: backoff,
      errSnippet: `HTTP ${res.status} ${bodyText.slice(0, 120)}`,
      ctx: options.retryLog,
    });
    await new Promise((r) => setTimeout(r, backoff));
  }
  throw new Error("fetchWithRetry: unreachable");
}
