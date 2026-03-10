/**
 * Git operations: toRemoteUrl, resolveSha, resolveBranchSha, resolveBranchShaSoft, setCloneIdentity.
 */
import { EXIT, fail } from "./errors.ts";
import { run, runSoft } from "./run.ts";
import type { Pin } from "./types.ts";

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
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
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
  if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) {
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
  return sha && /^[0-9a-f]{40}$/i.test(sha) ? sha : null;
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

/**
 * Parse owner/repo from a GitHub source string.
 * Handles: github.com/owner/repo, https://github.com/owner/repo,
 * https://x-access-token:token@github.com/owner/repo, git@github.com:owner/repo.git
 * Returns "owner/repo" or null if not a GitHub URL.
 */
export function parseGitHubRepo(source: string): string | null {
  const m = source.match(
    /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i
  );
  return m ? `${m[1]}/${m[2]}` : null;
}
