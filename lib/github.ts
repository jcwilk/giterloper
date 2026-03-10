/**
 * GitHub API operations (merge) for remote-only workflows.
 * Keeps clones shallow; merge is performed on GitHub, not locally.
 */
import { EXIT, fail } from "./errors.ts";

/**
 * Parse github.com/owner/repo into { owner, repo }.
 * Returns null if not a github.com source.
 */
export function parseGithubSource(source: string): { owner: string; repo: string } | null {
  if (!source.includes("github.com")) return null;
  const match = source.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export interface MergeResult {
  sha: string;
  merged: boolean;
}

/**
 * Merge head into base via GitHub API.
 * Requires GITERLOPER_GH_TOKEN. No local fetch.
 *
 * Returns { sha, merged } on success. On 204 (already up-to-date), base already
 * contains head; we refetch base SHA to confirm.
 */
export async function mergeBranchesRemotely(
  source: string,
  baseBranch: string,
  headBranch: string,
  commitMessage: string
): Promise<MergeResult> {
  const parsed = parseGithubSource(source);
  if (!parsed) {
    fail("remote merge requires github.com source", EXIT.USER);
  }
  const token = Deno.env.get("GITERLOPER_GH_TOKEN");
  if (!token) {
    fail(
      "remote merge requires GITERLOPER_GH_TOKEN (for github.com API)",
      EXIT.EXTERNAL
    );
  }
  const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/merges`;
  const body = JSON.stringify({
    base: baseBranch,
    head: headBranch,
    commit_message: commitMessage,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body,
  });
  const status = res.status;
  if (status === 201) {
    const data = (await res.json()) as { sha?: string };
    const sha = data?.sha;
    if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) {
      fail("GitHub API returned invalid merge commit SHA", EXIT.EXTERNAL);
    }
    return { sha, merged: true };
  }
  if (status === 204) {
    // Already up-to-date (base contains head). Base branch tip is unchanged.
    const refRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    if (!refRes.ok) fail("failed to get base branch ref after merge", EXIT.EXTERNAL);
    const d = (await refRes.json()) as { object?: { sha?: string } };
    const sha = d?.object?.sha;
    if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) {
      fail("GitHub API returned invalid ref SHA", EXIT.EXTERNAL);
    }
    return { sha, merged: false };
  }
  if (status === 409) {
    fail(
      [
        "Merge conflict: branches cannot be merged automatically.",
        "Resolve on GitHub: create a pull request from the source branch into the target branch,",
        "resolve conflicts in the GitHub UI, merge the PR, then run:",
        "  gl pin update <target-pin>",
      ].join(" "),
      EXIT.STATE
    );
  }
  const text = await res.text();
  fail(
    `GitHub merge API failed (${status}): ${text}`,
    EXIT.EXTERNAL
  );
  throw new Error("unreachable");
}
