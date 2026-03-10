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

function cleanupLocalCopies(pinName: string | null): void {
  if (!pinName) return;

  const root = Deno.cwd();
  const versionsDir = path.join(root, ".giterloper", "versions", pinName);
  const stagedDir = path.join(root, ".giterloper", "staged", pinName);

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

interface CleanupOpts {
  pinName?: string | null;
  branchName?: string | null;
}

export function cleanupTestKnowledgeRepo(
  remoteSource: string,
  cleanMainSha: string,
  opts: string | CleanupOpts | null = null
): void {
  const pinName = typeof opts === "string" ? opts : opts?.pinName ?? null;
  const branchName = typeof opts === "object" && opts?.branchName ? opts.branchName : null;

  cleanupLocalCopies(pinName);

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
  } else {
    for (const branch of branches) {
      if (branch === "main") continue;
      runGit(["push", remoteUrl, "--delete", branch]);
    }
  }

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

  cleanupLocalCopies(pinName);
}
