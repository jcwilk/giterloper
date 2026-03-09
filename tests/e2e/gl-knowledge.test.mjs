import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { after, before, test } from "node:test";

import {
  E2E_MARKER,
  TEST_SOURCE,
  TEST_TOPIC_BODY,
  TEST_TOPIC_PATH,
  TEST_TOPIC_TITLE,
  CLEAN_MAIN_SHA,
  TEST_MAIN_REF,
  toRemoteUrl,
} from "./config.mjs";

/** Unique per test file run; ALL collision-prone names must include this. */
const RUN_ID = `${E2E_MARKER}${randomBytes(8).toString("hex")}`;
const TEST_PIN_NAME = `test_knowledge_${RUN_ID}`;
const WORKFLOW_BRANCH = RUN_ID;

import { runGl, runGlJson } from "../helpers/gl.mjs";
import { cleanupTestKnowledgeRepo } from "../helpers/cleanup.mjs";

function asText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value);
}

function getPin(state, pinName) {
  return state.find((entry) => entry.name === pinName);
}

function stagedDir(pinName, branch) {
  return path.join(process.cwd(), ".giterloper", "staged", pinName, branch);
}

function cloneDir(pinName, sha) {
  return path.join(process.cwd(), ".giterloper", "versions", pinName, sha);
}

function branchContentText() {
  return [`# ${TEST_TOPIC_TITLE}`, "", TEST_TOPIC_BODY].join("\n");
}

function runGit(args, { cwd = process.cwd(), silent = false } = {}) {
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

  return (result.stdout || "").trim();
}

function scratchPinName(prefix) {
  return `${prefix}_${RUN_ID}_${randomBytes(4).toString("hex")}`;
}

function ensurePinRemoved(pinName) {
  const pins = runGlJson(["pin", "list"]);
  if (getPin(pins, pinName)) {
    runGlJson(["pin", "remove", pinName]);
  }
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

    const filePath = path.join(repoDir, contentPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contentBody, "utf8");
    const relativePath = path.relative(repoDir, filePath);
    runGit(["add", relativePath], { cwd: repoDir });
    runGit(["commit", "-m", `Test branch content for ${branchName}`], { cwd: repoDir });
    runGit(["push", "origin", `HEAD:${branchName}`], { cwd: repoDir });

    const sha = runGit(["rev-parse", "HEAD"], { cwd: repoDir });
    return sha;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

before(() => {
  cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName: TEST_PIN_NAME, branchName: WORKFLOW_BRANCH });
  createRemoteBranchFromMain(WORKFLOW_BRANCH, TEST_TOPIC_PATH, branchContentText());
  runGlJson(["pin", "add", TEST_PIN_NAME, TEST_SOURCE, "--ref", WORKFLOW_BRANCH, "--branch", WORKFLOW_BRANCH]);
});

test("stage creates a working clone", () => {
  const pinName = scratchPinName("scratch-stage");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const stageResult = runGlJson(["stage", branch, "--pin", pinName]);
    assert.equal(stageResult.created, true, "stage should create branch for first run");
    const dir = stagedDir(pinName, branch);
    assert.equal(stageResult.staged, dir, "stage command should return expected path");
    assert.ok(fs.existsSync(dir), "staged dir should exist");
    assert.ok(fs.existsSync(path.join(dir, "CONSTITUTION.md")), "staged dir should contain repository files");
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("write content to staged clone", () => {
  const pinName = scratchPinName("scratch-write");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const dir = stagedDir(pinName, branch);
    runGlJson(["stage", branch, "--pin", pinName]);
    const filePath = path.join(dir, TEST_TOPIC_PATH);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, branchContentText(), "utf8");
    const content = fs.readFileSync(filePath, "utf8");
    assert.match(content, /Test Topic for E2E/);
    assert.match(content, /e2e-topic-keyword/);
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("promote pushes and updates pin", () => {
  const pinName = scratchPinName("scratch-promote");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const beforePins = runGlJson(["pin", "list"]);
    const beforePin = getPin(beforePins, pinName);
    assert.ok(beforePin, "test pin should exist before promote");
    const dir = stagedDir(pinName, branch);
    runGlJson(["stage", branch, "--pin", pinName]);
    const filePath = path.join(dir, TEST_TOPIC_PATH);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, branchContentText(), "utf8");
    runGlJson(["promote", "--pin", pinName]);
    const afterPins = runGlJson(["pin", "list"]);
    const afterPin = getPin(afterPins, pinName);
    assert.ok(afterPin, "test pin should exist after promote");
    assert.notEqual(afterPin.sha, beforePin.sha, "pin sha should change after promote");
    assert.ok(fs.existsSync(cloneDir(pinName, afterPin.sha)), "pinned clone should exist for new sha");
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("search finds added content", () => {
  const result = runGlJson(["search", "test topic for e2e", "--pin", TEST_PIN_NAME]);
  const haystack = asText(result).toLowerCase();
  assert.ok(result.length > 0, `expected search output to return at least one result, got: ${haystack}`);
  const topicFound = result.some((entry) => {
    const text = asText(entry).toLowerCase();
    return (
      text.includes(TEST_TOPIC_TITLE.toLowerCase()) || text.includes(TEST_TOPIC_PATH.toLowerCase())
    );
  });
  assert.ok(topicFound, `expected search output to reference the added test topic, got: ${haystack}`);
});

test("query answers from added content", () => {
  const result = runGlJson(["query", "What does the test topic say?", "--pin", TEST_PIN_NAME]);
  const haystack = asText(result).toLowerCase();
  assert.ok(
    haystack.includes(TEST_TOPIC_TITLE.toLowerCase()) || haystack.includes(TEST_TOPIC_BODY.toLowerCase()),
    `expected query output to reference the added topic, got: ${haystack}`
  );
});

test("get retrieves full document", () => {
  const result = runGlJson(["get", TEST_TOPIC_PATH, "--pin", TEST_PIN_NAME, "--full"]);
  const haystack = asText(result);
  assert.ok(
    haystack.includes("e2e-topic-keyword"),
    `expected get output to include topic body, got: ${haystack}`
  );
  assert.ok(
    haystack.includes(TEST_TOPIC_TITLE),
    `expected get output to include topic title, got: ${haystack}`
  );
});

test("verify reports healthy state", () => {
  const result = runGlJson(["verify", "--pin", TEST_PIN_NAME]);
  assert.equal(result.ok, true, "verify should report ok=true");
  assert.equal(result.checks.length > 0, true, "verify should include checks");
  const check = result.checks[0];
  assert.equal(check.pin, TEST_PIN_NAME, "check should target test pin");
  assert.equal(check.clonePresent, true, "clone should be present");
  assert.equal(check.cloneShaOk, true, "clone should match pinned sha");
  assert.equal(check.collectionPresent, true, "collection should be present");
  assert.equal(check.contextPresent, true, "context should be present");
  assert.equal(check.vectorsOk, true, "vectors should be ready");
});

test("stage-cleanup removes staged clone", () => {
  const branch = `${RUN_ID}_cleanup`;
  const staged = runGlJson(["stage", branch, "--pin", TEST_PIN_NAME]);
  const stagedPath = staged.staged;
  assert.ok(fs.existsSync(stagedPath), "staged path should exist before cleanup");
  const cleanup = runGlJson(["stage-cleanup", branch, "--pin", TEST_PIN_NAME]);
  assert.ok(cleanup.cleaned, "cleanup should report cleaned");
  assert.equal(cleanup.path, stagedPath, "cleanup path should match stage path");
  assert.ok(!fs.existsSync(stagedPath), "staged path should be removed after cleanup");
});

test("stage same branch reuses existing", () => {
  const pinName = scratchPinName("scratch-reuse");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const first = runGlJson(["stage", branch, "--pin", pinName]);
    assert.equal(first.created, true, "first stage call should create clone");
    const second = runGlJson(["stage", branch, "--pin", pinName]);
    assert.equal(second.created, false, "second stage call should reuse existing clone");
    assert.equal(second.staged, first.staged, "stage should reuse same path");
    runGlJson(["stage-cleanup", branch, "--pin", pinName]);
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("pin list includes the test pin", () => {
  const pins = runGlJson(["pin", "list"]);
  const pin = getPin(pins, TEST_PIN_NAME);
  assert.ok(pin, "test pin should appear in pin list");
  assert.equal(pin.name, TEST_PIN_NAME);
  assert.equal(pin.source, TEST_SOURCE);
  assert.ok(pin.sha, "pin sha should be populated");
});

test("pin remove removes local pin data", () => {
  const pinName = scratchPinName("scratch-remove");
  try {
    const added = runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", TEST_MAIN_REF]);
    assert.equal(added.name, pinName);
    assert.ok(fs.existsSync(cloneDir(pinName, added.sha)), "clone should create pin version");
    const removed = runGlJson(["pin", "remove", pinName]);
    assert.equal(removed.removed, true, "pin remove should report removed");
    assert.equal(getPin(runGlJson(["pin", "list"]), pinName), undefined, "pin should no longer exist");
    assert.equal(
      fs.existsSync(path.join(process.cwd(), ".giterloper", "versions", pinName)),
      false,
      "pin versions directory should be removed"
    );
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("pin update advances pin sha", () => {
  const pinName = scratchPinName("scratch-update");
  const branchName = `${pinName}-branch`;
  try {
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", TEST_MAIN_REF]);
    const originalSha = getPin(runGlJson(["pin", "list"]), pinName).sha;
    const branchSha = createRemoteBranchFromMain(
      branchName,
      `knowledge/e2e-update_${RUN_ID}_${randomBytes(4).toString("hex")}.md`,
      `# Update marker for ${pinName}\n`
    );
    const update = runGlJson(["pin", "update", pinName, "--ref", branchName]);
    assert.equal(update.updated, true, "pin update should report updated");
    assert.equal(update.name, pinName);
    assert.equal(update.oldSha, originalSha, "pin update should record previous SHA");
    assert.equal(update.newSha, branchSha, "pin update should update to branch SHA");
    const pin = getPin(runGlJson(["pin", "list"]), pinName);
    assert.ok(pin, "pin should still exist after update");
    assert.equal(pin.sha, branchSha, "pinned sha should match updated hash");
  } finally {
    ensurePinRemoved(pinName);
  }
});

test("status returns pinned state", () => {
  const status = runGlJson(["status"]);
  assert.ok(Array.isArray(status.pins), "status should include pins");
  assert.ok(status.pins.length > 0, "status should include at least one pin");
  const pin = getPin(status.pins, TEST_PIN_NAME);
  assert.ok(pin, "status should report test pin");
  assert.equal(pin.name, TEST_PIN_NAME);
  assert.equal(pin.cloneExists, true, "test pin clone should exist");
  assert.equal(pin.cloneAtExpectedSha, true, "test pin clone should match pinned sha");
  assert.equal(pin.collectionExists, true, "test pin collection should exist");
  assert.equal(pin.contextExists, true, "test pin context should exist");
});

after(() => {
  try {
    runGlJson(["teardown", TEST_PIN_NAME]);
  } finally {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName: TEST_PIN_NAME, branchName: WORKFLOW_BRANCH });
  }
});
