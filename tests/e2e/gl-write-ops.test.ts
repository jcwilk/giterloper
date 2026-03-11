import { assertEquals } from "jsr:@std/assert";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

Deno.test("insert queues content in knowledge/pending and advances pin sha", () => {
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
    const filePath = path.join(stagedDir(pinName, branch), "knowledge", "pending", result.file!);
    assertEquals(existsSync(filePath), true);
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
