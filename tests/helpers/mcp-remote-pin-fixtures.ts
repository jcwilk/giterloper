/**
 * CLI + git fixtures for MCP HTTP E2E tests that need a named pin on the shared test knowledge remote.
 * Uses `--mcp-test-mode` and `integrationMcpModeChildEnv()`; pair spawned MCP servers with
 * `GITERLOPER_TEST_MCP_STATE_SESSION_ID` when aligning server state with these sessions.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

import {
  CLEAN_MAIN_SHA,
  E2E_MARKER,
  TEST_MAIN_REF,
  TEST_SOURCE,
  toRemoteUrl,
} from "./config.ts";
import { GITERLOPER_REPO_ROOT, giterloperSessionRoot, runGlJson, runGlMaintenanceJson } from "./gl.ts";
import { runGit } from "./run-git.ts";

function getPin(list: unknown, name: string): { name?: string; sha?: string } | undefined {
  const arr = Array.isArray(list) ? list : [];
  return (arr as { name?: string }[]).find((p) => p.name === name) as
    | { name?: string; sha?: string }
    | undefined;
}

export function randomPin(prefix: string): string {
  return `${prefix}_${E2E_MARKER}${randomBytes(8).toString("hex")}`;
}

export function ensurePinRemoved(name: string, sessionId: string): void {
  const pins = runGlJson(["pin", "list"], { cwd: GITERLOPER_REPO_ROOT, sessionId }) as { name?: string }[];
  if (getPin(pins, name)) runGlJson(["pin", "remove", name], { cwd: GITERLOPER_REPO_ROOT, sessionId });
}

function cleanupLocalCopies(pinName: string, sessionId: string): void {
  const sessionRoot = giterloperSessionRoot(GITERLOPER_REPO_ROOT, sessionId);
  const versionsDir = path.join(sessionRoot, "versions", pinName);
  const stagedDirPath = path.join(sessionRoot, "staged", pinName);
  try {
    rmSync(versionsDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  try {
    rmSync(stagedDirPath, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export function cleanupTestRepo(opts: { pinName: string; branchName?: string; sessionId: string }): void {
  cleanupLocalCopies(opts.pinName, opts.sessionId);
  const url = toRemoteUrl(TEST_SOURCE);
  const remoteHeads = runGit(["ls-remote", "--heads", url]);
  const branches = remoteHeads
    .split("\n")
    .map((l) => l.trim().split(/\s+/)[1]?.replace("refs/heads/", ""))
    .filter(Boolean) as string[];
  if (opts.branchName && branches.includes(opts.branchName)) {
    runGit(["push", url, "--delete", opts.branchName]);
  }
  const tempRoot = path.join(tmpdir(), `giterloper-mcp-e2e-${randomBytes(4).toString("hex")}`);
  try {
    runGit(["clone", "--quiet", url, path.join(tempRoot, "repo")]);
    const repoDir = path.join(tempRoot, "repo");
    runGit(["checkout", CLEAN_MAIN_SHA], { cwd: repoDir });
    runGit(["push", "--force", "origin", `${CLEAN_MAIN_SHA}:refs/heads/main`], { cwd: repoDir });
    if (opts.branchName) {
      runGit(["checkout", "-b", opts.branchName], { cwd: repoDir });
      runGit(["push", "--force", "origin", `HEAD:refs/heads/${opts.branchName}`], {
        cwd: repoDir,
      });
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  cleanupLocalCopies(opts.pinName, opts.sessionId);
}

export function createRemoteBranch(
  branchName: string,
  contentPath: string,
  contentBody: string
): string {
  const tempRoot = path.join(tmpdir(), `giterloper-mcp-branch-${randomBytes(4).toString("hex")}`);
  const repoDir = path.join(tempRoot, "repo");
  try {
    runGit(["clone", "--quiet", toRemoteUrl(TEST_SOURCE), repoDir]);
    runGit(["checkout", TEST_MAIN_REF], { cwd: repoDir });
    runGit(["checkout", "-b", branchName], { cwd: repoDir });
    runGit(["config", "user.name", "giterloper-test"], { cwd: repoDir });
    runGit(["config", "user.email", "giterloper-test@example.com"], { cwd: repoDir });
    const fullPath = path.join(repoDir, contentPath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, contentBody, "utf8");
    runGit(["add", path.relative(repoDir, fullPath)], { cwd: repoDir });
    runGit(["commit", "-m", `Test branch ${branchName}`], { cwd: repoDir });
    runGit(["push", "origin", `HEAD:${branchName}`], { cwd: repoDir });
    return runGit(["rev-parse", "HEAD"], { cwd: repoDir });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function addTestPin(
  pinName: string,
  branch: string,
  initialContentPath: string,
  initialContent: string,
  sessionId: string
): void {
  runGlJson(
    ["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch],
    { cwd: GITERLOPER_REPO_ROOT, sessionId }
  );
  runGlMaintenanceJson(["stage", branch, "--pin", pinName], { cwd: GITERLOPER_REPO_ROOT, sessionId });
  const stagedPath = path.join(
    giterloperSessionRoot(GITERLOPER_REPO_ROOT, sessionId),
    "staged",
    pinName,
    branch,
  );
  if (!existsSync(stagedPath)) {
    throw new Error(`Stage failed: ${stagedPath} does not exist`);
  }
  const filePath = path.join(stagedPath, initialContentPath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, initialContent, "utf8");
  runGlMaintenanceJson(["promote", "--pin", pinName], { cwd: GITERLOPER_REPO_ROOT, sessionId });
  runGlJson(["pin", "load", "--pin", pinName], { cwd: GITERLOPER_REPO_ROOT, sessionId });
}
