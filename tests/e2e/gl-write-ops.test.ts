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
  TEST_SUBTRACT_CONTENT,
  toRemoteUrl,
} from "./config.ts";
import { runGlJson } from "../helpers/gl.ts";

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

Deno.test("add queues content in added and advances pin sha", () => {
  const pinName = randomPin("add");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlJson(["stage", branch, "--pin", pinName]);
    const before = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    const result = runGlJson(["add", "--pin", pinName], { stdin: TEST_ADD_CONTENT }) as {
      action?: string;
      file?: string;
    };
    assertEquals(result.action, "added");
    const filePath = path.join(stagedDir(pinName, branch), "added", result.file!);
    assertEquals(existsSync(filePath), true);
    const after = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    assertEquals(after!.sha !== before!.sha, true);
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("subtract queues content in subtracts and advances pin sha", () => {
  const pinName = randomPin("subtract");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlJson(["stage", branch, "--pin", pinName]);
    runGlJson(["add", "--pin", pinName], { stdin: TEST_ADD_CONTENT });
    const before = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    const result = runGlJson(["subtract", "--pin", pinName], { stdin: TEST_SUBTRACT_CONTENT }) as {
      action?: string;
      file?: string;
    };
    assertEquals(result.action, "subtracted");
    const filePath = path.join(stagedDir(pinName, branch), "subtracts", result.file!);
    assertEquals(existsSync(filePath), true);
    const after = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    assertEquals(after!.sha !== before!.sha, true);
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("add with --name uses requested file name", () => {
  const pinName = randomPin("add-name");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlJson(["stage", branch, "--pin", pinName]);
    const result = runGlJson(["add", "--pin", pinName, "--name", "named-entry"], {
      stdin: "hello",
    }) as { file?: string };
    assertEquals(result.file, "named-entry.md");
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("reconcile processes queued files", () => {
  const pinName = randomPin("reconcile");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlJson(["stage", branch, "--pin", pinName]);
    runGlJson(["add", "--pin", pinName, "--name", "to-reconcile"], {
      stdin: "# reconcile test content",
    });
    const result = runGlJson(["reconcile", "--pin", pinName]) as {
      action?: string;
      commits?: number;
    };
    assertEquals(result.action, "reconciled");
    assertEquals((result.commits ?? 0) >= 1, true);
  } finally {
    ensurePinRemoved(pinName);
  }
});
