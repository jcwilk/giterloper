/**
 * GitHub API operations (merge, partial SHA resolution) for remote-only workflows.
 * Keeps clones shallow; merge is performed on GitHub, not locally.
 *
 * Auth: uses GITERLOPER_GH_TOKEN if set, otherwise `gh auth token` (session-based).
 */
import { EXIT, fail } from "./errors.ts";
import { runSoft } from "./run.ts";

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

/**
 * Resolve a partial SHA to full 40-char form via GitHub API.
 * GET /repos/{owner}/{repo}/commits/{sha} accepts partial SHAs.
 * Requires parseGithubSource(source) to succeed. Uses GITERLOPER_GH_TOKEN when set.
 */
export async function resolvePartialShaViaGithub(source: string, shortSha: string): Promise<string> {
  const parsed = parseGithubSource(source);
  if (!parsed) {
    fail(
      "partial SHA resolution requires a github.com source; use full 40-char SHA for other remotes",
      EXIT.USER
    );
  }
  const token = getGitHubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
  };
  const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits/${shortSha}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    fail(
      `could not resolve partial SHA "${shortSha}": ${res.status} ${text}`,
      EXIT.EXTERNAL
    );
  }
  const data = (await res.json()) as { sha?: string };
  const full = data?.sha;
  if (!full || !/^[0-9a-f]{40}$/i.test(full)) {
    fail(`GitHub API returned invalid SHA for ${shortSha}`, EXIT.EXTERNAL);
  }
  return full;
}

export interface MergeResult {
  sha: string;
  merged: boolean;
}

/**
 * Get GitHub API token from GITERLOPER_GH_TOKEN or `gh auth token` (session-based).
 * Returns null if no token is available (caller can fall back to git log).
 */
export function getGitHubTokenSoft(): string | null {
  const envToken = Deno.env.get("GITERLOPER_GH_TOKEN");
  if (envToken?.trim()) return envToken.trim();
  const gh = runSoft("gh", ["auth", "token"]);
  return gh.ok && gh.stdout?.trim() ? gh.stdout.trim() : null;
}

/**
 * Get GitHub API token from GITERLOPER_GH_TOKEN or `gh auth token` (session-based).
 */
function getGitHubToken(): string {
  const t = getGitHubTokenSoft();
  if (t) return t;
  fail(
    "GitHub API requires auth. Set GITERLOPER_GH_TOKEN or run `gh auth login` for session-based auth.",
    EXIT.EXTERNAL
  );
  throw new Error("unreachable");
}

/**
 * Get the commit date (epoch seconds) of the oldest commit that touched the given path,
 * via GitHub API. Used for ordering pending files when local git log is unreliable (e.g. shallow clone).
 * Returns 0 if the API is unavailable or the path has no commits.
 */
export async function getFileAddEpochViaApi(
  source: string,
  path: string,
  sha: string
): Promise<number> {
  const parsed = parseGithubSource(source);
  if (!parsed) return 0;
  const token = getGitHubTokenSoft();
  if (!token) return 0;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
  };
  let page = 1;
  const perPage = 100;
  let lastCommit: { commit?: { committer?: { date?: string } } } | null = null;
  for (;;) {
    const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?sha=${encodeURIComponent(sha)}&path=${encodeURIComponent(path)}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return 0;
    const data = (await res.json()) as Array<{ commit?: { committer?: { date?: string } } }>;
    if (!Array.isArray(data) || data.length === 0) break;
    lastCommit = data[data.length - 1];
    if (data.length < perPage) break;
    page += 1;
  }
  if (!lastCommit?.commit?.committer?.date) return 0;
  const epoch = Math.floor(new Date(lastCommit.commit.committer.date).getTime() / 1000);
  return isNaN(epoch) ? 0 : epoch;
}

/**
 * Merge head into base via GitHub API.
 * Auth: GITERLOPER_GH_TOKEN or `gh auth token` (session-based). No local fetch.
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
  const token = getGitHubToken();
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
