/**
 * Git operations: toRemoteUrl, resolveSha, resolveShaOrRef, resolveBranchSha, resolveBranchShaSoft, setCloneIdentity.
 */
import { EXIT, fail } from "./errors.ts";
import { resolvePartialShaViaGithub } from "./github.ts";
import { runGitNetwork } from "./retry-external.ts";
import { run, runSoft } from "./run.ts";
import type { RetryLogContext } from "./types.ts";

const SHA_FULL = /^[0-9a-f]{40}$/i;
const SHA_ABBREV = /^[0-9a-f]{7,39}$/i;

export function isFullSha(s: string): boolean {
  return SHA_FULL.test(s);
}

/** True if the string looks like an abbreviated SHA (7–39 hex chars). */
export function isAbbreviatedSha(s: string): boolean {
  return SHA_ABBREV.test(s);
}

/**
 * Resolve a ref or SHA to a full 40-char SHA.
 * - Full SHA (40 hex): return as-is.
 * - Abbreviated SHA (7–39 hex): expand via GitHub API (github.com only).
 * - Otherwise: resolve via ls-remote (branch, tag, etc.).
 */
export async function resolveShaOrRef(
  source: string,
  refOrSha: string,
  retryLog?: RetryLogContext
): Promise<string> {
  if (isFullSha(refOrSha)) return refOrSha;
  if (isAbbreviatedSha(refOrSha)) return resolvePartialShaViaGithub(source, refOrSha, retryLog);
  return resolveSha(source, refOrSha, retryLog);
}

export function toRemoteUrl(source: string): string {
  if (
    source.startsWith("http://") ||
    source.startsWith("https://") ||
    source.startsWith("git@")
  ) {
    return source;
  }
  const token = Deno.env.get("GITERLOPER_GH_TOKEN");
  if (token && source.includes("github.com")) {
    return `https://x-access-token:${token}@${source}`;
  }
  return `https://${source}`;
}

export function resolveSha(source: string, ref: string = "HEAD", retryLog?: RetryLogContext): string {
  const remote = toRemoteUrl(source);
  const out = runGitNetwork(["ls-remote", remote, ref], {}, {
    operation: `git ls-remote ${ref}`,
    logContext: retryLog,
  });
  if (!out.ok || !out.stdout) {
    fail(`could not resolve ref "${ref}" for ${source}`, EXIT.EXTERNAL);
  }
  const first = out.stdout.split(/\r?\n/).find(Boolean);
  if (!first) fail(`could not resolve ref "${ref}" for ${source}`, EXIT.EXTERNAL);
  const sha = first.split(/\s+/)[0];
  if (!SHA_FULL.test(sha)) {
    fail(`unexpected SHA while resolving ${source}@${ref}: ${sha}`, EXIT.EXTERNAL);
  }
  return sha;
}

export function resolveBranchSha(source: string, branch: string, retryLog?: RetryLogContext): string {
  const remote = toRemoteUrl(source);
  const out = runGitNetwork(["ls-remote", "--heads", remote, branch], {}, {
    operation: "git ls-remote --heads",
    logContext: retryLog,
  });
  if (!out.ok || !out.stdout) {
    fail(`could not resolve branch "${branch}" for ${source}`, EXIT.EXTERNAL);
  }
  const first = out.stdout.split(/\r?\n/).find(Boolean);
  const sha = first?.split(/\s+/)?.[0];
  if (!sha || !SHA_FULL.test(sha)) {
    fail(`unexpected SHA while resolving ${source}@${branch}: ${sha || "<none>"}`, EXIT.EXTERNAL);
  }
  return sha;
}

export function resolveBranchShaSoft(source: string, branch: string, retryLog?: RetryLogContext): string | null {
  const { reachable, remoteSha } = resolveBranchShaReachable(source, branch, retryLog);
  return reachable ? remoteSha : null;
}

/**
 * Like resolveBranchShaSoft but distinguishes "remote unreachable" from "branch not on remote yet".
 * Used by assertBranchFresh to fail only when the remote cannot be reached, not when the branch simply does not exist yet.
 */
export function resolveBranchShaReachable(
  source: string,
  branch: string,
  retryLog?: RetryLogContext
): { reachable: boolean; remoteSha: string | null } {
  const remote = toRemoteUrl(source);
  const out = runGitNetwork(["ls-remote", "--heads", remote, branch], {}, {
    operation: "git ls-remote --heads (reachable)",
    logContext: retryLog,
  });
  if (!out.ok) return { reachable: false, remoteSha: null };
  if (!out.stdout) return { reachable: true, remoteSha: null };
  const first = out.stdout.split(/\r?\n/).find(Boolean);
  const sha = first?.split(/\s+/)?.[0];
  return { reachable: true, remoteSha: sha && SHA_FULL.test(sha) ? sha : null };
}

/**
 * Get remote.origin URL from a repo, normalized to https form for github.com.
 * Returns null if remote.origin is not set.
 */
export function getRemoteOriginUrl(repoDir: string): string | null {
  const out = runSoft("git", ["-C", repoDir, "config", "--get", "remote.origin.url"]);
  if (!out.ok || !out.stdout?.trim()) return null;
  let url = out.stdout.trim();
  if (url.startsWith("git@")) {
    url = "https://" + url.slice(4).replace(":", "/");
  }
  if (url.endsWith(".git")) url = url.slice(0, -4);
  url = url.replace(/\/$/, ""); // so parseGithubSource regex (e.g. $) matches
  return url;
}

export function setCloneIdentity(dir: string): void {
  const name = runSoft("git", ["-C", dir, "config", "user.name"]);
  if (!name.ok || !name.stdout.trim()) {
    run("git", ["-C", dir, "config", "user.name", "giterloper"]);
  }
  const email = runSoft("git", ["-C", dir, "config", "user.email"]);
  if (!email.ok || !email.stdout.trim()) {
    run("git", ["-C", dir, "config", "user.email", "giterloper@localhost"]);
  }
}
