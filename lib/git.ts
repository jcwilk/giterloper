/**
 * Git operations: toRemoteUrl, resolveSha, resolveShaOrRef, resolveBranchSha, resolveBranchShaSoft, setCloneIdentity.
 */
import { EXIT, fail } from "./errors.ts";
import { resolvePartialShaViaGithub } from "./github.ts";
import { run, runSoft } from "./run.ts";
import type { Pin } from "./types.ts";

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
export async function resolveShaOrRef(source: string, refOrSha: string): Promise<string> {
  if (isFullSha(refOrSha)) return refOrSha;
  if (isAbbreviatedSha(refOrSha)) return resolvePartialShaViaGithub(source, refOrSha);
  return resolveSha(source, refOrSha);
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

export function resolveSha(source: string, ref: string = "HEAD"): string {
  const remote = toRemoteUrl(source);
  const out = run("git", ["ls-remote", remote, ref]);
  const first = out.split(/\r?\n/).find(Boolean);
  if (!first) fail(`could not resolve ref "${ref}" for ${source}`, EXIT.EXTERNAL);
  const sha = first.split(/\s+/)[0];
  if (!SHA_FULL.test(sha)) {
    fail(`unexpected SHA while resolving ${source}@${ref}: ${sha}`, EXIT.EXTERNAL);
  }
  return sha;
}

export function resolveBranchSha(source: string, branch: string): string {
  const remote = toRemoteUrl(source);
  const out = runSoft("git", ["ls-remote", "--heads", remote, branch]);
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

export function resolveBranchShaSoft(source: string, branch: string): string | null {
  const remote = toRemoteUrl(source);
  const out = runSoft("git", ["ls-remote", "--heads", remote, branch]);
  if (!out.ok || !out.stdout) return null;
  const first = out.stdout.split(/\r?\n/).find(Boolean);
  const sha = first?.split(/\s+/)?.[0];
  return sha && SHA_FULL.test(sha) ? sha : null;
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
