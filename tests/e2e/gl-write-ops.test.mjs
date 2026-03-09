import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  E2E_MARKER,
  CLEAN_MAIN_SHA,
  TEST_ADD_CONTENT,
  TEST_MAIN_REF,
  TEST_SOURCE,
  TEST_SUBTRACT_CONTENT,
} from "./config.mjs";
import { runGl, runGlJson } from "../helpers/gl.mjs";

/** Unique per test file run; ALL collision-prone names must include this. */
const RUN_ID = `${E2E_MARKER}${randomBytes(8).toString("hex")}`;
const WORK_BRANCH = RUN_ID;

function randomPin(prefix) {
  return `${prefix}_${RUN_ID}_${randomBytes(4).toString("hex")}`;
}

function stagedDir(pinName, branch) {
  return path.join(process.cwd(), ".giterloper", "staged", pinName, branch);
}

function runGit(args, { cwd = process.cwd() } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git failed").trim());
  }
  return (result.stdout || "").trim();
}

function pinByName(list, name) {
  return list.find((p) => p.name === name);
}

function ensurePinRemoved(name) {
  const pins = runGlJson(["pin", "list"]);
  if (pinByName(pins, name)) runGlJson(["pin", "remove", name]);
}

function createRemoteBranchFromMain(branchName, contentPath, contentBody) {
  const tempRoot = fs.mkdtempSync(path.join(tmpdir(), "giterloper-branch-"));
  const repoDir = path.join(tempRoot, "repo");
  try {
    runGit(["clone", "--quiet", `git@github.com:jcwilk/giterloper_test_knowledge.git`, repoDir]);
    runGit(["checkout", TEST_MAIN_REF], { cwd: repoDir });
    runGit(["checkout", "-b", branchName], { cwd: repoDir });
    runGit(["config", "user.name", "giterloper-test"], { cwd: repoDir });
    runGit(["config", "user.email", "giterloper-test@example.com"], { cwd: repoDir });
    const fullPath = path.join(repoDir, contentPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contentBody, "utf8");
    runGit(["add", path.relative(repoDir, fullPath)], { cwd: repoDir });
    runGit(["commit", "-m", `Test branch ${branchName}`], { cwd: repoDir });
    runGit(["push", "origin", `HEAD:${branchName}`], { cwd: repoDir });
    return runGit(["rev-parse", "HEAD"], { cwd: repoDir });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function pushCommitToBranch(branch, contentPath, contentBody) {
  const tempRoot = fs.mkdtempSync(path.join(tmpdir(), "giterloper-stale-"));
  const repoDir = path.join(tempRoot, "repo");
  try {
    runGit(["clone", "--quiet", `git@github.com:jcwilk/giterloper_test_knowledge.git`, repoDir]);
    runGit(["checkout", branch], { cwd: repoDir });
    runGit(["config", "user.name", "giterloper-test"], { cwd: repoDir });
    runGit(["config", "user.email", "giterloper-test@example.com"], { cwd: repoDir });
    const fullPath = path.join(repoDir, contentPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contentBody, "utf8");
    runGit(["add", path.relative(repoDir, fullPath)], { cwd: repoDir });
    runGit(["commit", "-m", `stale update ${Date.now()}`], { cwd: repoDir });
    runGit(["push", "origin", `HEAD:${branch}`], { cwd: repoDir });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("add queues content in added and advances pin sha", () => {
  const pinName = randomPin("add");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlJson(["stage", branch, "--pin", pinName]);
    const before = pinByName(runGlJson(["pin", "list"]), pinName);
    const result = runGlJson(["add", "--pin", pinName], { stdin: TEST_ADD_CONTENT });
    assert.equal(result.action, "added");
    const filePath = path.join(stagedDir(pinName, branch), "added", result.file);
    assert.equal(fs.existsSync(filePath), true);
    const after = pinByName(runGlJson(["pin", "list"]), pinName);
    assert.notEqual(after.sha, before.sha);
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("subtract queues content in subtracts and advances pin sha", () => {
  const pinName = randomPin("subtract");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlJson(["stage", branch, "--pin", pinName]);
    runGlJson(["add", "--pin", pinName], { stdin: TEST_ADD_CONTENT });
    const before = pinByName(runGlJson(["pin", "list"]), pinName);
    const result = runGlJson(["subtract", "--pin", pinName], { stdin: TEST_SUBTRACT_CONTENT });
    assert.equal(result.action, "subtracted");
    const filePath = path.join(stagedDir(pinName, branch), "subtracts", result.file);
    assert.equal(fs.existsSync(filePath), true);
    const after = pinByName(runGlJson(["pin", "list"]), pinName);
    assert.notEqual(after.sha, before.sha);
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("add with --name uses requested file name", () => {
  const pinName = randomPin("add-name");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlJson(["stage", branch, "--pin", pinName]);
    const result = runGlJson(["add", "--pin", pinName, "--name", "named-entry"], { stdin: "hello" });
    assert.equal(result.file, "named-entry.md");
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("add fails for branchless pin", () => {
  const branchlessPin = randomPin("branchless");
  try {
    runGlJson(["pin", "add", branchlessPin, TEST_SOURCE, "--ref", TEST_MAIN_REF]);
    assert.throws(() => runGl(["add", "--pin", branchlessPin], { stdin: "x" }), /has no branch/i);
  } finally {
    ensurePinRemoved(branchlessPin);
  }
});

test("promote fails for branchless pin", () => {
  const branchlessPin = randomPin("branchless");
  try {
    runGlJson(["pin", "add", branchlessPin, TEST_SOURCE, "--ref", TEST_MAIN_REF]);
    assert.throws(() => runGl(["promote", "--pin", branchlessPin]), /has no branch/i);
  } finally {
    ensurePinRemoved(branchlessPin);
  }
});

test("reconcile processes queued files", () => {
  const pinName = randomPin("reconcile");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlJson(["stage", branch, "--pin", pinName]);
    runGlJson(["add", "--pin", pinName, "--name", "to-reconcile"], { stdin: "# reconcile test content" });
    const result = runGlJson(["reconcile", "--pin", pinName]);
    assert.equal(result.action, "reconciled");
    assert.equal(result.commits >= 1, true);
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("merge combines two branched pins", () => {
  const sourcePin = randomPin("merge-src");
  const targetPin = randomPin("merge-tgt");
  const sharedBranch = `merge_${RUN_ID}_${randomBytes(4).toString("hex")}`;
  try {
    createRemoteBranchFromMain(sharedBranch, "knowledge/scratch.md", "# base");
    runGlJson(["pin", "add", sourcePin, TEST_SOURCE, "--ref", sharedBranch, "--branch", sharedBranch]);
    runGlJson(["pin", "add", targetPin, TEST_SOURCE, "--ref", sharedBranch, "--branch", sharedBranch]);
    runGlJson(["add", "--pin", sourcePin, "--name", "source-only"], {
      stdin: "# source-only\n\nmerge source marker",
    });
    runGlJson(["merge", sourcePin, targetPin]);
    const merged = pinByName(runGlJson(["pin", "list"]), targetPin);
    assert.ok(merged.sha);
  } finally {
    ensurePinRemoved(sourcePin);
    ensurePinRemoved(targetPin);
  }
});

test("stale branch is detected for write operations", () => {
  const pinName = randomPin("stale");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlJson(["stage", branch, "--pin", pinName]);
    pushCommitToBranch(
      branch,
      `knowledge/stale_${RUN_ID}_${randomBytes(4).toString("hex")}.md`,
      `# stale marker\n\n${Date.now()}`
    );
    assert.throws(
      () => runGl(["add", "--pin", pinName], { stdin: "should fail as stale" }),
      /stale|remote branch has commits/i
    );
  } finally {
    ensurePinRemoved(pinName);
  }
});
