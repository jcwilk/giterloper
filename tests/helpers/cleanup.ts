import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function toRemoteUrl(source: string): string {
  const token = Deno.env.get("GITERLOPER_GH_TOKEN");
  if (token && source.includes("github.com")) {
    return `https://x-access-token:${token}@${source}`;
  }
  return `https://${source}`;
}

function runGit(
  args: string[],
  opts: { cwd?: string | null; silent?: boolean } = {}
): string {
  const result = spawnSync("git", args, {
    cwd: opts.cwd ?? undefined,
    encoding: "utf8",
    stdio: ["ignore", opts.silent ? "ignore" : "pipe", "pipe"],
  });

  if (result.error) {
    throw new Error(`Failed to run git: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || result.stdout || "git command failed").trim();
    throw new Error(stderr);
  }

  return (result.stdout || "").trim();
}

function cleanupLocalCopies(pinName: string | null, sessionId: string, cwd: string): void {
  if (!pinName) return;

  const versionsDir = path.join(cwd, ".giterloper", sessionId, "versions", pinName);
  const stagedDir = path.join(cwd, ".giterloper", sessionId, "staged", pinName);

  try {
    rmSync(versionsDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  try {
    rmSync(stagedDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export interface CleanupOpts {
  pinName?: string | null;
  branchName?: string | null;
  /** Required when `pinName` is set (local session tree cleanup under `.giterloper/<sessionId>/`). */
  sessionId?: string;
  /** Process cwd that owns `.giterloper/<sessionId>/`; defaults to `Deno.cwd()`. */
  cwd?: string;
}

export function cleanupTestKnowledgeRepo(
  remoteSource: string,
  cleanMainSha: string,
  opts: CleanupOpts | null = null
): void {
  const pinName = opts?.pinName ?? null;
  const branchName = opts?.branchName ? opts.branchName : null;
  const sessionId = opts?.sessionId;
  const stateCwd = opts?.cwd ?? Deno.cwd();

  if (pinName && !sessionId) {
    throw new Error("cleanupTestKnowledgeRepo: sessionId is required when pinName is set");
  }

  if (pinName && sessionId) {
    cleanupLocalCopies(pinName, sessionId, stateCwd);
  }

  const remoteUrl = toRemoteUrl(remoteSource);

  const remoteHeads = runGit(["ls-remote", "--heads", remoteUrl]);
  const branches = remoteHeads
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const ref = parts[1];
      return ref?.replace("refs/heads/", "");
    })
    .filter(Boolean);

  if (branchName) {
    if (branches.includes(branchName)) {
      runGit(["push", remoteUrl, "--delete", branchName]);
    }
  }
  // Intentionally no "delete all non-main branches" path: incompatible with parallel suites.

  const tempRoot = mkdtempSync(path.join(tmpdir(), "giterloper-test-"));
  try {
    runGit(["clone", "--quiet", remoteUrl, tempRoot + "/repo"]);
    const repoDir = path.join(tempRoot, "repo");
    runGit(["checkout", cleanMainSha], { cwd: repoDir });
    runGit(["push", "--force", "origin", `${cleanMainSha}:refs/heads/main`], { cwd: repoDir });
    if (branchName) {
      runGit(["checkout", "-b", branchName], { cwd: repoDir });
      runGit(["push", "--force", "origin", `HEAD:refs/heads/${branchName}`], { cwd: repoDir });
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  if (pinName && sessionId) {
    cleanupLocalCopies(pinName, sessionId, stateCwd);
  }
}
