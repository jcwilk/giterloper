import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function runGit(args, { cwd = null, silent = false } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", silent ? "ignore" : "pipe", "pipe"],
  });

  if (result.error) {
    throw new Error(`Failed to run git: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || result.stdout || "git command failed").trim();
    throw new Error(stderr);
  }

  return result.stdout || "";
}

function cleanupLocalCopies(pinName) {
  if (!pinName) return;

  const versionsDir = path.join(process.cwd(), ".giterloper", "versions", pinName);
  const stagedDir = path.join(process.cwd(), ".giterloper", "staged", pinName);

  rmSync(versionsDir, { recursive: true, force: true });
  rmSync(stagedDir, { recursive: true, force: true });
}

export function cleanupTestKnowledgeRepo(remoteSource, cleanMainSha, pinName = null) {
  cleanupLocalCopies(pinName);

  const remoteUrl = remoteSource.startsWith("http")
    ? remoteSource
    : `git@github.com:${remoteSource.replace(/^github\.com\//, "")}.git`;

  const remoteHeads = runGit(["ls-remote", "--heads", remoteUrl]);
  const branches = remoteHeads
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [, ref] = line.split(/\s+/);
      return ref?.replace("refs/heads/", "");
    })
    .filter(Boolean);

  for (const branch of branches) {
    if (branch === "main") continue;
    runGit(["push", remoteUrl, "--delete", branch]);
  }

  const tempRoot = mkdtempSync(path.join(tmpdir(), "giterloper-test-"));
  try {
    runGit(["clone", "--quiet", remoteUrl, tempRoot + "/repo"]);
    const repoDir = path.join(tempRoot, "repo");
    runGit(["checkout", cleanMainSha], { cwd: repoDir });
    runGit(["push", "--force", "origin", `${cleanMainSha}:refs/heads/main`], { cwd: repoDir });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  cleanupLocalCopies(pinName);
}
