import { assertEquals } from "jsr:@std/assert";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { TEST_MAIN_REF, TEST_SOURCE, toRemoteUrl } from "../helpers/config.ts";
import {
  createTestRuntimeContext,
  destroyTestRuntimeContext,
  giterloperSessionRoot,
  runGlJson,
  runGlMaintenanceJson,
  scratchPinName,
} from "../helpers/gl.ts";
import { runGit } from "../helpers/run-git.ts";

const ctx = createTestRuntimeContext();
addEventListener("unload", () => {
  destroyTestRuntimeContext(ctx);
});

function glj(args: string[], o: { stdin?: string | null } = {}) {
  return runGlJson(args, { ctx, ...o });
}

function glm(args: string[]) {
  return runGlMaintenanceJson(args, { ctx });
}

function stagedDir(pinName: string, branch: string): string {
  return path.join(giterloperSessionRoot(ctx.cwd, ctx.sessionId), "staged", pinName, branch);
}

function pinByName(list: { name?: string }[], name: string): { name?: string; sha?: string } | undefined {
  return list.find((p) => p.name === name);
}

function ensurePinRemoved(name: string): void {
  const pins = glj(["pin", "list"]) as { name?: string }[];
  if (pinByName(pins, name)) glj(["pin", "remove", name]);
}

function createRemoteBranchFromMain(
  branchName: string,
  contentPath: string,
  contentBody: string
): string {
  const tempRoot = Deno.makeTempDirSync({ prefix: "giterloper-branch-" });
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

/** End-to-end reconcile: test runner sets GITERLOPER_RECONCILE_LLM_TEST_STUB (see scripts/run-tests.ts) so integration is deterministic without a live model. */
Deno.test("reconcile processes _pending into decomposed corpus files and deletes pending", () => {
  const pinName = scratchPinName(ctx, "reconcile");
  const branch = `${pinName}-branch`;
  try {
    const pendingContent = "# Reconcile Test Topic\n\nContent with marker `reconcile-e2e-marker`.";
    createRemoteBranchFromMain(branch, "knowledge/_pending/reconcile-test.md", pendingContent);
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    glm(["stage", branch, "--pin", pinName]);
    const before = pinByName(glj(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    const result = glj(["reconcile", "--pin", pinName]) as {
      action?: string;
      oldSha?: string;
      newSha?: string;
      touched?: string[];
      deleted?: string[];
    };
    assertEquals(result.action, "reconciled");
    const touched = result.touched ?? [];
    assertEquals(touched.some((p) => p.startsWith("knowledge/reconcile-test-topic/")), true);
    assertEquals(touched.length >= 2, true);
    assertEquals(result.deleted?.includes("knowledge/_pending/reconcile-test.md"), true);
    const staged = stagedDir(pinName, branch);
    const topicDir = path.join(staged, "knowledge", "reconcile-test-topic");
    assertEquals(existsSync(topicDir), true);
    let combined = "";
    for (const rel of touched.filter((p) => p.startsWith("knowledge/reconcile-test-topic/"))) {
      combined += readFileSync(path.join(staged, rel), "utf8");
    }
    assertEquals(combined.includes("reconcile-e2e-marker"), true);
    assertEquals(combined.includes("## Sources"), true);
    assertEquals(combined.includes("`reconcile-test.md`"), true);
    const pendingPath = path.join(stagedDir(pinName, branch), "knowledge", "_pending", "reconcile-test.md");
    assertEquals(existsSync(pendingPath), false);
    const after = pinByName(glj(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    assertEquals(after!.sha !== before!.sha, true);
  } finally {
    ensurePinRemoved(pinName);
  }
});
