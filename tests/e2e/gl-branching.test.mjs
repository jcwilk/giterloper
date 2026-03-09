import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  E2E_MARKER,
  TEST_ADD_CONTENT,
  TEST_MAIN_REF,
  TEST_SOURCE,
  toRemoteUrl,
} from "./config.mjs";
import { runGl, runGlJson } from "../helpers/gl.mjs";

/** Unique per test file run; ALL collision-prone names must include this. */
const RUN_ID = `${E2E_MARKER}${randomBytes(8).toString("hex")}`;

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
    runGit(["clone", "--quiet", toRemoteUrl(TEST_SOURCE), repoDir]);
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
    runGit(["clone", "--quiet", toRemoteUrl(TEST_SOURCE), repoDir]);
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

function createBranchFromBranch(parentBranch, newBranch, contentPath, contentBody) {
  const tempRoot = fs.mkdtempSync(path.join(tmpdir(), "giterloper-branch-from-"));
  const repoDir = path.join(tempRoot, "repo");
  try {
    runGit(["clone", "--quiet", toRemoteUrl(TEST_SOURCE), repoDir]);
    runGit(["checkout", parentBranch], { cwd: repoDir });
    runGit(["checkout", "-b", newBranch], { cwd: repoDir });
    runGit(["config", "user.name", "giterloper-test"], { cwd: repoDir });
    runGit(["config", "user.email", "giterloper-test@example.com"], { cwd: repoDir });
    const fullPath = path.join(repoDir, contentPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contentBody, "utf8");
    runGit(["add", path.relative(repoDir, fullPath)], { cwd: repoDir });
    runGit(["commit", "-m", `Branch ${newBranch} from ${parentBranch}`], { cwd: repoDir });
    runGit(["push", "origin", `HEAD:${newBranch}`], { cwd: repoDir });
    return runGit(["rev-parse", "HEAD"], { cwd: repoDir });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

// --- Branchless pin blocks write operations ---

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

test("reconcile fails for branchless pin", () => {
  const branchlessPin = randomPin("branchless");
  try {
    runGlJson(["pin", "add", branchlessPin, TEST_SOURCE, "--ref", TEST_MAIN_REF]);
    assert.throws(() => runGl(["reconcile", "--pin", branchlessPin]), /has no branch/i);
  } finally {
    ensurePinRemoved(branchlessPin);
  }
});

test("subtract fails for branchless pin", () => {
  const branchlessPin = randomPin("branchless");
  try {
    runGlJson(["pin", "add", branchlessPin, TEST_SOURCE, "--ref", TEST_MAIN_REF]);
    assert.throws(() => runGl(["subtract", "--pin", branchlessPin], { stdin: "x" }), /has no branch/i);
  } finally {
    ensurePinRemoved(branchlessPin);
  }
});

// --- Create branch on pin add when branch does not exist ---

test("pin add with non-existent branch creates pin and clones from ref", () => {
  const pinName = randomPin("create-branch");
  const branch = `${pinName}-branch`;
  try {
    const result = runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", TEST_MAIN_REF, "--branch", branch]);
    assert.equal(result.name, pinName);
    assert.equal(result.branch, branch);
    assert.equal(result.ref, TEST_MAIN_REF);
    assert.ok(/^[0-9a-f]{40}$/i.test(result.sha), "pin sha should be 40-char hex");
    const pin = pinByName(runGlJson(["pin", "list"]), pinName);
    assert.ok(pin, "pin should exist after add");
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("add on newly created branch creates remote branch on first push", () => {
  const pinName = randomPin("create-on-push");
  const branch = `${pinName}-branch`;
  try {
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", TEST_MAIN_REF, "--branch", branch]);
    const addResult = runGlJson(["add", "--pin", pinName, "--name", "first-push"], { stdin: "# first" });
    assert.equal(addResult.action, "added");
    assert.ok(addResult.sha, "add should advance pin sha");
    const pin = pinByName(runGlJson(["pin", "list"]), pinName);
    assert.equal(pin.sha, addResult.sha);
  } finally {
    ensurePinRemoved(pinName);
  }
});

// --- Read operations do not push ---

test("query on branched pin does not create remote branch", () => {
  const pinName = randomPin("read-no-push");
  const branch = `${pinName}-branch`;
  try {
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", TEST_MAIN_REF, "--branch", branch]);
    const beforePins = runGlJson(["pin", "list"]);
    const beforePin = pinByName(beforePins, pinName);
    runGlJson(["query", "what content exists", "--pin", pinName]);
    const afterPins = runGlJson(["pin", "list"]);
    const afterPin = pinByName(afterPins, pinName);
    assert.equal(afterPin.sha, beforePin.sha, "query should not change pin sha");
  } finally {
    ensurePinRemoved(pinName);
  }
});

// --- Fail fast when branch exists but pin SHA does not match remote ---

test("add fails before staged copy when branch exists and pin SHA mismatches remote", () => {
  const pinName = randomPin("fail-fast");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    pushCommitToBranch(
      branch,
      `knowledge/stale_${RUN_ID}_${randomBytes(4).toString("hex")}.md`,
      `# stale marker\n\n${Date.now()}`
    );
    assert.throws(
      () => runGl(["add", "--pin", pinName], { stdin: "should fail" }),
      /does not match|remote HEAD|Pin the remote head/i
    );
    const stagedPath = stagedDir(pinName, branch);
    assert.ok(!fs.existsSync(stagedPath), "staged copy should not exist after fail-fast");
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("stage fails before clone when branch exists and pin SHA mismatches remote", () => {
  const pinName = randomPin("stage-fail-fast");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    pushCommitToBranch(
      branch,
      `knowledge/stale_${RUN_ID}_${randomBytes(4).toString("hex")}.md`,
      `# stale\n\n${Date.now()}`
    );
    assert.throws(
      () => runGl(["stage", branch, "--pin", pinName]),
      /does not match|remote HEAD|Pin the remote head/i
    );
  } finally {
    ensurePinRemoved(pinName);
  }
});

// --- Merge ---
// Skip: gl merge is WIP; fails with shallow fetch (depth=1). See ISSUES.md #6.

test.skip("merge combines two branched pins", () => {
  const sourcePin = randomPin("merge-src");
  const targetPin = randomPin("merge-tgt");
  const targetBranch = `merge_tgt_${RUN_ID}_${randomBytes(4).toString("hex")}`;
  const sourceBranch = `merge_src_${RUN_ID}_${randomBytes(4).toString("hex")}`;
  const sourceFile = `knowledge/merge_src_${RUN_ID}_${randomBytes(4).toString("hex")}.md`;
  try {
    createRemoteBranchFromMain(targetBranch, "knowledge/scratch.md", "# target base");
    createBranchFromBranch(targetBranch, sourceBranch, sourceFile, "# source addition");
    runGlJson(["pin", "add", sourcePin, TEST_SOURCE, "--ref", sourceBranch, "--branch", sourceBranch]);
    runGlJson(["pin", "add", targetPin, TEST_SOURCE, "--ref", targetBranch, "--branch", targetBranch]);
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

// --- Branch exists and matches: normal write flow ---

test("add succeeds when branch exists and pin SHA matches remote", () => {
  const pinName = randomPin("match-flow");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlJson(["stage", branch, "--pin", pinName]);
    const result = runGlJson(["add", "--pin", pinName], { stdin: TEST_ADD_CONTENT });
    assert.equal(result.action, "added");
    const filePath = path.join(stagedDir(pinName, branch), "added", result.file);
    assert.equal(fs.existsSync(filePath), true);
  } finally {
    ensurePinRemoved(pinName);
  }
});
