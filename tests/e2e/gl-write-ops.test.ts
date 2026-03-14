import { assertEquals } from "jsr:@std/assert";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

import {
  E2E_MARKER,
  TEST_ADD_CONTENT,
  TEST_MAIN_REF,
  TEST_SOURCE,
  toRemoteUrl,
} from "./config.ts";
import { runGlMaintenanceJson, runGlJson } from "../helpers/gl.ts";

const RUN_ID = `${E2E_MARKER}${randomBytes(8).toString("hex")}`;

function randomPin(prefix: string): string {
  return `${prefix}_${RUN_ID}_${randomBytes(4).toString("hex")}`;
}

function stagedDir(pinName: string, branch: string): string {
  return path.join(Deno.cwd(), ".giterloper", "staged", pinName, branch);
}

function runGit(args: string[], opts: { cwd?: string } = {}): string {
  const result = spawnSync("git", args, {
    cwd: opts.cwd ?? Deno.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git failed").trim());
  }
  return (result.stdout || "").trim();
}

function pinByName(list: { name?: string }[], name: string): { name?: string; sha?: string } | undefined {
  return list.find((p) => p.name === name);
}

function ensurePinRemoved(name: string): void {
  const pins = runGlJson(["pin", "list"]) as { name?: string }[];
  if (pinByName(pins, name)) runGlJson(["pin", "remove", name]);
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
  const pinName = randomPin("insert");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlMaintenanceJson(["stage", branch, "--pin", pinName]);
    const before = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    const result = runGlJson(["insert", "--pin", pinName], { stdin: TEST_ADD_CONTENT }) as {
      action?: string;
      file?: string;
    };
    assertEquals(result.action, "inserted");
    const filePath = path.join(stagedDir(pinName, branch), "knowledge", "_pending", result.file!);
    assertEquals(existsSync(filePath), true);
    const after = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    assertEquals(after!.sha !== before!.sha, true);
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("install-remote copies CONSTITUTION.md to GITERLOPER.md and advances pin sha", () => {
  const pinName = randomPin("install-remote");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const before = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    const result = runGlJson(["install-remote", pinName]) as {
      action?: string;
      file?: string;
      sha?: string;
    };
    assertEquals(result.action, "install-remote");
    assertEquals(result.file, "GITERLOPER.md");
    const destPath = path.join(stagedDir(pinName, branch), "GITERLOPER.md");
    assertEquals(existsSync(destPath), true);
    const constitutionPath = path.join(Deno.cwd(), "CONSTITUTION.md");
    const expected = readFileSync(constitutionPath, "utf8");
    const actual = readFileSync(destPath, "utf8");
    assertEquals(actual, expected);
    const after = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    assertEquals(after!.sha !== before!.sha, true);
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("reconcile processes _pending into topic files and deletes pending", () => {
  const pinName = randomPin("reconcile");
  const branch = `${pinName}-branch`;
  try {
    const pendingContent = "# Reconcile Test Topic\n\nContent with marker `reconcile-e2e-marker`.";
    createRemoteBranchFromMain(branch, "knowledge/_pending/reconcile-test.md", pendingContent);
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlMaintenanceJson(["stage", branch, "--pin", pinName]);
    const before = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    const result = runGlJson(["reconcile", "--pin", pinName]) as {
      action?: string;
      oldSha?: string;
      newSha?: string;
      touched?: string[];
      deleted?: string[];
    };
    assertEquals(result.action, "reconciled");
    assertEquals(result.touched?.includes("knowledge/reconcile-test-topic.md"), true);
    assertEquals(result.deleted?.includes("knowledge/_pending/reconcile-test.md"), true);
    const topicPath = path.join(stagedDir(pinName, branch), "knowledge", "reconcile-test-topic.md");
    assertEquals(existsSync(topicPath), true);
    const topicBody = readFileSync(topicPath, "utf8");
    assertEquals(topicBody.includes("reconcile-e2e-marker"), true);
    assertEquals(topicBody.includes("## Sources"), true);
    const pendingPath = path.join(stagedDir(pinName, branch), "knowledge", "_pending", "reconcile-test.md");
    assertEquals(existsSync(pendingPath), false);
    const after = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    assertEquals(after!.sha !== before!.sha, true);
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("insert with --name uses requested file name", () => {
  const pinName = randomPin("insert-name");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlMaintenanceJson(["stage", branch, "--pin", pinName]);
    const result = runGlJson(["insert", "--pin", pinName, "--name", "named-entry"], {
      stdin: "hello",
    }) as { file?: string };
    assertEquals(result.file, "named-entry.md");
  } finally {
    ensurePinRemoved(pinName);
  }
});
