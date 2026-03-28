import { assertEquals } from "jsr:@std/assert";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  TEST_ADD_CONTENT,
  TEST_MAIN_REF,
  TEST_SOURCE,
  toRemoteUrl,
} from "../helpers/config.ts";
import {
  createTestRuntimeContext,
  destroyTestRuntimeContext,
  GITERLOPER_REPO_ROOT,
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

Deno.test("insert queues content in knowledge/_pending and advances pin sha", () => {
  const pinName = scratchPinName(ctx, "insert");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    glm(["stage", branch, "--pin", pinName]);
    const before = pinByName(glj(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    const result = glj(["insert", "--pin", pinName], { stdin: TEST_ADD_CONTENT }) as {
      action?: string;
      file?: string;
    };
    assertEquals(result.action, "inserted");
    const filePath = path.join(stagedDir(pinName, branch), "knowledge", "_pending", result.file!);
    assertEquals(existsSync(filePath), true);
    const after = pinByName(glj(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    assertEquals(after!.sha !== before!.sha, true);
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("install-remote copies docs/CONSTITUTION.md to GITERLOPER.md and advances pin sha", () => {
  const pinName = scratchPinName(ctx, "install-remote");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const before = pinByName(glj(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    const docsDir = path.join(ctx.cwd, "docs");
    mkdirSync(docsDir, { recursive: true });
    copyFileSync(
      path.join(GITERLOPER_REPO_ROOT, "docs", "CONSTITUTION.md"),
      path.join(docsDir, "CONSTITUTION.md")
    );
    const result = glj(["install-remote", pinName]) as {
      action?: string;
      file?: string;
      sha?: string;
    };
    assertEquals(result.action, "install-remote");
    assertEquals(result.file, "GITERLOPER.md");
    const destPath = path.join(stagedDir(pinName, branch), "GITERLOPER.md");
    assertEquals(existsSync(destPath), true);
    const constitutionPath = path.join(GITERLOPER_REPO_ROOT, "docs", "CONSTITUTION.md");
    const expected = readFileSync(constitutionPath, "utf8");
    const actual = readFileSync(destPath, "utf8");
    assertEquals(actual, expected);
    const after = pinByName(glj(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    assertEquals(after!.sha !== before!.sha, true);
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("insert with --name uses requested file name", () => {
  const pinName = scratchPinName(ctx, "insert-name");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    glm(["stage", branch, "--pin", pinName]);
    const result = glj(["insert", "--pin", pinName, "--name", "named-entry"], {
      stdin: "hello",
    }) as { file?: string };
    assertEquals(result.file, "named-entry.md");
  } finally {
    ensurePinRemoved(pinName);
  }
});
