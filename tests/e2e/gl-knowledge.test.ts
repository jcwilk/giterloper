/**
 * E2E test suite for gl knowledge workflow. Uses a single Deno.test with setup/teardown
 * because tests share state (TEST_PIN_NAME) from a before hook.
 */
import { assertEquals, assert, assertMatch } from "jsr:@std/assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  E2E_MARKER,
  TEST_SOURCE,
  TEST_TOPIC_BODY,
  TEST_TOPIC_PATH,
  TEST_TOPIC_TITLE,
  CLEAN_MAIN_SHA,
  TEST_MAIN_REF,
  toRemoteUrl,
} from "./config.ts";
import { runGlJson } from "../helpers/gl.ts";
import { cleanupTestKnowledgeRepo } from "../helpers/cleanup.ts";

const RUN_ID = `${E2E_MARKER}${randomBytes(8).toString("hex")}`;
const TEST_PIN_NAME = `test_knowledge_${RUN_ID}`;
const WORKFLOW_BRANCH = RUN_ID;

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value);
}

function getPin(state: unknown, pinName: string): { name: string; sha?: string; source?: string } | undefined {
  const pins = Array.isArray(state) ? state : [];
  return pins.find((p: { name?: string }) => p.name === pinName);
}

function stagedDir(pinName: string, branch: string): string {
  return join(Deno.cwd(), ".giterloper", "staged", pinName, branch);
}

function cloneDir(pinName: string, sha: string): string {
  return join(Deno.cwd(), ".giterloper", "versions", pinName, sha);
}

function branchContentText(): string {
  return [`# ${TEST_TOPIC_TITLE}`, "", TEST_TOPIC_BODY].join("\n");
}

function runGit(args: string[], opts: { cwd?: string; silent?: boolean } = {}): string {
  const result = spawnSync("git", args, {
    cwd: opts.cwd ?? Deno.cwd(),
    encoding: "utf8",
    stdio: ["ignore", opts.silent ? "ignore" : "pipe", "pipe"],
  });
  if (result.error) throw new Error(`Failed to run git: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git failed").trim());
  }
  return (result.stdout || "").trim();
}

function scratchPinName(prefix: string): string {
  return `${prefix}_${RUN_ID}_${randomBytes(4).toString("hex")}`;
}

function ensurePinRemoved(pinName: string): void {
  const pins = runGlJson(["pin", "list"]) as { name?: string }[];
  if (getPin(pins, pinName)) {
    runGlJson(["pin", "remove", pinName]);
  }
}

function createRemoteBranchFromMain(branchName: string, contentPath: string, contentBody: string): string {
  const tempRoot = Deno.makeTempDirSync({ prefix: "giterloper-branch-" });
  const repoDir = join(tempRoot, "repo");
  try {
    runGit(["clone", "--quiet", toRemoteUrl(TEST_SOURCE), repoDir]);
    runGit(["checkout", TEST_MAIN_REF], { cwd: repoDir });
    runGit(["checkout", "-b", branchName], { cwd: repoDir });
    runGit(["config", "user.name", "giterloper-test"], { cwd: repoDir });
    runGit(["config", "user.email", "giterloper-test@example.com"], { cwd: repoDir });
    const filePath = join(repoDir, contentPath);
    Deno.mkdirSync(join(filePath, ".."), { recursive: true });
    Deno.writeTextFileSync(filePath, contentBody);
    runGit(["add", contentPath], { cwd: repoDir });
    runGit(["commit", "-m", `Test branch content for ${branchName}`], { cwd: repoDir });
    runGit(["push", "origin", `HEAD:${branchName}`], { cwd: repoDir });
    return runGit(["rev-parse", "HEAD"], { cwd: repoDir });
  } finally {
    Deno.removeSync(tempRoot, { recursive: true });
  }
}

Deno.test("gl-knowledge e2e workflow", async () => {
  try {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName: TEST_PIN_NAME, branchName: WORKFLOW_BRANCH });
    createRemoteBranchFromMain(WORKFLOW_BRANCH, TEST_TOPIC_PATH, branchContentText());
    runGlJson(["pin", "add", TEST_PIN_NAME, TEST_SOURCE, "--ref", WORKFLOW_BRANCH, "--branch", WORKFLOW_BRANCH]);

    // stage creates a working clone
    const pinName1 = scratchPinName("scratch-stage");
    const branch1 = `${pinName1}-branch`;
    try {
      createRemoteBranchFromMain(branch1, "knowledge/scratch.md", "# scratch");
      runGlJson(["pin", "add", pinName1, TEST_SOURCE, "--ref", branch1, "--branch", branch1]);
      const stageResult = runGlJson(["stage", branch1, "--pin", pinName1]) as { created?: boolean; staged?: string };
      assertEquals(stageResult.created, true);
      const dir = stagedDir(pinName1, branch1);
      assertEquals(stageResult.staged, dir);
      assert(existsSync(dir));
      assert(existsSync(join(dir, "CONSTITUTION.md")));
    } finally {
      ensurePinRemoved(pinName1);
    }

    // write content to staged clone
    const pinName2 = scratchPinName("scratch-write");
    const branch2 = `${pinName2}-branch`;
    try {
      createRemoteBranchFromMain(branch2, "knowledge/scratch.md", "# scratch");
      runGlJson(["pin", "add", pinName2, TEST_SOURCE, "--ref", branch2, "--branch", branch2]);
      const dir = stagedDir(pinName2, branch2);
      runGlJson(["stage", branch2, "--pin", pinName2]);
      Deno.mkdirSync(join(dir, TEST_TOPIC_PATH, ".."), { recursive: true });
      Deno.writeTextFileSync(join(dir, TEST_TOPIC_PATH), branchContentText());
      const content = Deno.readTextFileSync(join(dir, TEST_TOPIC_PATH));
      assertMatch(content, /Test Topic for E2E/);
      assertMatch(content, /e2e-topic-keyword/);
    } finally {
      ensurePinRemoved(pinName2);
    }

    // promote pushes and updates pin
    const pinName3 = scratchPinName("scratch-promote");
    const branch3 = `${pinName3}-branch`;
    try {
      createRemoteBranchFromMain(branch3, "knowledge/scratch.md", "# scratch");
      runGlJson(["pin", "add", pinName3, TEST_SOURCE, "--ref", branch3, "--branch", branch3]);
      const beforePins = runGlJson(["pin", "list"]) as { name?: string; sha?: string }[];
      const beforePin = getPin(beforePins, pinName3);
      assert(beforePin);
      const dir = stagedDir(pinName3, branch3);
      runGlJson(["stage", branch3, "--pin", pinName3]);
      Deno.mkdirSync(join(dir, TEST_TOPIC_PATH, ".."), { recursive: true });
      Deno.writeTextFileSync(join(dir, TEST_TOPIC_PATH), branchContentText());
      runGlJson(["promote", "--pin", pinName3]);
      const afterPins = runGlJson(["pin", "list"]) as { name?: string; sha?: string }[];
      const afterPin = getPin(afterPins, pinName3);
      assert(afterPin);
      assert(afterPin.sha !== beforePin!.sha);
      assert(existsSync(cloneDir(pinName3, afterPin.sha!)));
    } finally {
      ensurePinRemoved(pinName3);
    }

    // search finds added content
    const searchResult = runGlJson(["search", "test topic for e2e", "--pin", TEST_PIN_NAME]);
    const haystack = asText(searchResult).toLowerCase();
    assert(Array.isArray(searchResult) && (searchResult as unknown[]).length > 0, `expected search results, got: ${haystack}`);
    const topicFound = (searchResult as unknown[]).some((entry) => {
      const text = asText(entry).toLowerCase();
      return text.includes(TEST_TOPIC_TITLE.toLowerCase()) || text.includes(TEST_TOPIC_PATH.toLowerCase());
    });
    assert(topicFound, `expected search to reference test topic, got: ${haystack}`);

    // query answers from added content
    const queryResult = runGlJson(["query", "What does the test topic say?", "--pin", TEST_PIN_NAME]);
    const queryHaystack = asText(queryResult).toLowerCase();
    assert(
      queryHaystack.includes(TEST_TOPIC_TITLE.toLowerCase()) || queryHaystack.includes(TEST_TOPIC_BODY.toLowerCase()),
      `expected query to reference topic, got: ${queryHaystack}`
    );

    // get retrieves full document
    const getResult = runGlJson(["get", TEST_TOPIC_PATH, "--pin", TEST_PIN_NAME, "--full"]) as string;
    assert(getResult.includes("e2e-topic-keyword"));
    assert(getResult.includes(TEST_TOPIC_TITLE));

    // verify reports healthy state
    const verifyResult = runGlJson(["verify", "--pin", TEST_PIN_NAME]) as { ok?: boolean; checks?: unknown[] };
    assertEquals(verifyResult.ok, true);
    assert((verifyResult.checks?.length ?? 0) > 0);
    const check = (verifyResult.checks as { pin?: string; clonePresent?: boolean; cloneShaOk?: boolean; collectionPresent?: boolean; contextPresent?: boolean; vectorsOk?: boolean }[])[0];
    assertEquals(check.pin, TEST_PIN_NAME);
    assertEquals(check.clonePresent, true);
    assertEquals(check.cloneShaOk, true);
    assertEquals(check.collectionPresent, true);
    assertEquals(check.contextPresent, true);
    assertEquals(check.vectorsOk, true);

    // stage-cleanup removes staged clone
    const cleanupBranch = `${RUN_ID}_cleanup`;
    const staged = runGlJson(["stage", cleanupBranch, "--pin", TEST_PIN_NAME]) as { staged?: string };
    const stagedPath = staged.staged!;
    assert(existsSync(stagedPath));
    const cleanup = runGlJson(["stage-cleanup", cleanupBranch, "--pin", TEST_PIN_NAME]) as { cleaned?: boolean; path?: string };
    assert(cleanup.cleaned);
    assertEquals(cleanup.path, stagedPath);
    assert(!existsSync(stagedPath));

    // stage same branch reuses existing
    const pinName4 = scratchPinName("scratch-reuse");
    const branch4 = `${pinName4}-branch`;
    try {
      createRemoteBranchFromMain(branch4, "knowledge/scratch.md", "# scratch");
      runGlJson(["pin", "add", pinName4, TEST_SOURCE, "--ref", branch4, "--branch", branch4]);
      const first = runGlJson(["stage", branch4, "--pin", pinName4]) as { created?: boolean; staged?: string };
      assertEquals(first.created, true);
      const second = runGlJson(["stage", branch4, "--pin", pinName4]) as { created?: boolean; staged?: string };
      assertEquals(second.created, false);
      assertEquals(second.staged, first.staged);
      runGlJson(["stage-cleanup", branch4, "--pin", pinName4]);
    } finally {
      ensurePinRemoved(pinName4);
    }

    // pin list includes the test pin
    const pins = runGlJson(["pin", "list"]) as { name?: string; source?: string; sha?: string }[];
    const pin = getPin(pins, TEST_PIN_NAME);
    assert(pin);
    assertEquals(pin.name, TEST_PIN_NAME);
    assertEquals(pin.source, TEST_SOURCE);
    assert(pin.sha);

    // pin remove removes local pin data
    const pinName5 = scratchPinName("scratch-remove");
    try {
      const added = runGlJson(["pin", "add", pinName5, TEST_SOURCE, "--ref", TEST_MAIN_REF]) as { name?: string; sha?: string };
      assertEquals(added.name, pinName5);
      assert(existsSync(cloneDir(pinName5, added.sha!)));
      const removed = runGlJson(["pin", "remove", pinName5]) as { removed?: boolean };
      assertEquals(removed.removed, true);
      assertEquals(getPin(runGlJson(["pin", "list"]), pinName5), undefined);
      assert(!existsSync(join(Deno.cwd(), ".giterloper", "versions", pinName5)));
    } finally {
      ensurePinRemoved(pinName5);
    }

    // pin update advances pin sha
    const pinName6 = scratchPinName("scratch-update");
    const branchName6 = `${pinName6}-branch`;
    try {
      runGlJson(["pin", "add", pinName6, TEST_SOURCE, "--ref", TEST_MAIN_REF]);
      const originalSha = (getPin(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName6))!.sha;
      const branchSha = createRemoteBranchFromMain(
        branchName6,
        `knowledge/e2e-update_${RUN_ID}_${randomBytes(4).toString("hex")}.md`,
        `# Update marker for ${pinName6}\n`
      );
      const update = runGlJson(["pin", "update", pinName6, "--ref", branchName6]) as { updated?: boolean; name?: string; oldSha?: string; newSha?: string };
      assertEquals(update.updated, true);
      assertEquals(update.name, pinName6);
      assertEquals(update.oldSha, originalSha);
      assertEquals(update.newSha, branchSha);
      const pinAfter = getPin(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName6);
      assert(pinAfter);
      assertEquals(pinAfter.sha, branchSha);
    } finally {
      ensurePinRemoved(pinName6);
    }

    // status returns pinned state
    const status = runGlJson(["status"]) as { pins?: unknown[] };
    assert(Array.isArray(status.pins));
    assert(status.pins!.length > 0);
    const statusPin = getPin(status.pins, TEST_PIN_NAME) as { name?: string; cloneExists?: boolean; cloneAtExpectedSha?: boolean; collectionExists?: boolean; contextExists?: boolean };
    assert(statusPin);
    assertEquals(statusPin.name, TEST_PIN_NAME);
    assertEquals(statusPin.cloneExists, true);
    assertEquals(statusPin.cloneAtExpectedSha, true);
    assertEquals(statusPin.collectionExists, true);
    assertEquals(statusPin.contextExists, true);
  } finally {
    try {
      runGlJson(["teardown", TEST_PIN_NAME]);
    } finally {
      cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName: TEST_PIN_NAME, branchName: WORKFLOW_BRANCH });
    }
  }
});
