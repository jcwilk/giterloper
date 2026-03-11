import { assertEquals, assertExists, assertMatch } from "jsr:@std/assert";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
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

import { runGlMaintenanceJson, runGlJson } from "../helpers/gl.ts";
import { cleanupTestKnowledgeRepo } from "../helpers/cleanup.ts";

const RUN_ID = `${E2E_MARKER}${randomBytes(8).toString("hex")}`;
const TEST_PIN_NAME = `test_knowledge_${RUN_ID}`;
const WORKFLOW_BRANCH = RUN_ID;

function getPin(state: { name?: string }[] | unknown, pinName: string): { name?: string; source?: string; sha?: string } | undefined {
  const arr = Array.isArray(state) ? state : [];
  return arr.find((entry: { name?: string }) => entry.name === pinName);
}

function stagedDir(pinName: string, branch: string): string {
  return path.join(Deno.cwd(), ".giterloper", "staged", pinName, branch);
}

function cloneDir(pinName: string, sha: string): string {
  return path.join(Deno.cwd(), ".giterloper", "versions", pinName, sha);
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

  if (result.error) {
    throw new Error(`Failed to run git: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || result.stdout || "git command failed").trim();
    throw new Error(stderr);
  }

  return (result.stdout || "").trim();
}

function scratchPinName(prefix: string): string {
  return `${prefix}_${RUN_ID}_${randomBytes(4).toString("hex")}`;
}

function ensurePinRemoved(pinName: string): void {
  const pins = runGlJson(["pin", "list"]);
  if (getPin(pins, pinName)) {
    runGlJson(["pin", "remove", pinName]);
  }
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

    const filePath = path.join(repoDir, contentPath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contentBody, "utf8");
    const relativePath = path.relative(repoDir, filePath);
    runGit(["add", relativePath], { cwd: repoDir });
    runGit(["commit", "-m", `Test branch content for ${branchName}`], { cwd: repoDir });
    runGit(["push", "origin", `HEAD:${branchName}`], { cwd: repoDir });

    return runGit(["rev-parse", "HEAD"], { cwd: repoDir });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

Deno.test("gl-knowledge e2e", async (t) => {
  await t.step("setup", async () => {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, {
      pinName: TEST_PIN_NAME,
      branchName: WORKFLOW_BRANCH,
    });
    createRemoteBranchFromMain(WORKFLOW_BRANCH, TEST_TOPIC_PATH, branchContentText());
    runGlJson(["pin", "add", TEST_PIN_NAME, TEST_SOURCE, "--ref", WORKFLOW_BRANCH, "--branch", WORKFLOW_BRANCH]);
  });

  await t.step("stage creates a working clone", () => {
    const pinName = scratchPinName("scratch-stage");
    const branch = `${pinName}-branch`;
    try {
      createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
      runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
      const stageResult = runGlMaintenanceJson(["stage", branch, "--pin", pinName]) as { created?: boolean; staged?: string };
      assertEquals(stageResult.created, true, "stage should create branch for first run");
      const dir = stagedDir(pinName, branch);
      assertEquals(stageResult.staged, dir, "stage command should return expected path");
      assertEquals(existsSync(dir), true, "staged dir should exist");
      assertEquals(existsSync(path.join(dir, "CONSTITUTION.md")), true, "staged dir should contain repository files");
    } finally {
      ensurePinRemoved(pinName);
    }
  });

  await t.step("write content to staged clone", () => {
    const pinName = scratchPinName("scratch-write");
    const branch = `${pinName}-branch`;
    try {
      createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
      runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
      const dir = stagedDir(pinName, branch);
      runGlMaintenanceJson(["stage", branch, "--pin", pinName]);
      const filePath = path.join(dir, TEST_TOPIC_PATH);
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, branchContentText(), "utf8");
      const content = readFileSync(filePath, "utf8");
      assertMatch(content, /Test Topic for E2E/);
      assertMatch(content, /e2e-topic-keyword/);
    } finally {
      ensurePinRemoved(pinName);
    }
  });

  await t.step("promote pushes and updates pin", () => {
    const pinName = scratchPinName("scratch-promote");
    const branch = `${pinName}-branch`;
    try {
      createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
      runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
      const beforePins = runGlJson(["pin", "list"]) as { name?: string; sha?: string }[];
      const beforePin = getPin(beforePins, pinName);
      assertExists(beforePin, "test pin should exist before promote");
      const dir = stagedDir(pinName, branch);
      runGlMaintenanceJson(["stage", branch, "--pin", pinName]);
      const filePath = path.join(dir, TEST_TOPIC_PATH);
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, branchContentText(), "utf8");
      runGlMaintenanceJson(["promote", "--pin", pinName]);
      const afterPins = runGlJson(["pin", "list"]) as { name?: string; sha?: string }[];
      const afterPin = getPin(afterPins, pinName);
      assertExists(afterPin, "test pin should exist after promote");
      assertEquals(afterPin!.sha !== beforePin!.sha, true, "pin sha should change after promote");
      assertEquals(existsSync(cloneDir(pinName, afterPin!.sha!)), true, "pinned clone should exist for new sha");
    } finally {
      ensurePinRemoved(pinName);
    }
  });

  await t.step("diagnostic reports healthy state (main gl)", () => {
    const result = runGlJson(["diagnostic", "--pin", TEST_PIN_NAME]) as {
      ok?: boolean;
      checks?: { pin?: string; clonePresent?: boolean; cloneShaOk?: boolean }[];
    };
    assertEquals(result.ok, true, "diagnostic should report ok=true");
    assertEquals((result.checks?.length ?? 0) > 0, true, "diagnostic should include checks");
    const check = result.checks![0];
    assertEquals(check.pin, TEST_PIN_NAME, "check should target test pin");
    assertEquals(check.clonePresent, true, "clone should be present");
    assertEquals(check.cloneShaOk, true, "clone should match pinned sha");
  });

  await t.step("verify reports healthy state (extended)", () => {
    const result = runGlMaintenanceJson(["verify", "--pin", TEST_PIN_NAME]) as {
      ok?: boolean;
      checks?: { pin?: string; clonePresent?: boolean; cloneShaOk?: boolean }[];
    };
    assertEquals(result.ok, true, "verify should report ok=true");
    assertEquals((result.checks?.length ?? 0) > 0, true, "verify should include checks");
    const check = result.checks![0];
    assertEquals(check.pin, TEST_PIN_NAME, "check should target test pin");
    assertEquals(check.clonePresent, true, "clone should be present");
    assertEquals(check.cloneShaOk, true, "clone should match pinned sha");
  });

  await t.step("stage-cleanup removes staged clone", () => {
    const branch = `${RUN_ID}_cleanup`;
    const staged = runGlMaintenanceJson(["stage", branch, "--pin", TEST_PIN_NAME]) as { staged?: string };
    const stagedPath = staged.staged!;
    assertEquals(existsSync(stagedPath), true, "staged path should exist before cleanup");
    const cleanup = runGlMaintenanceJson(["stage-cleanup", branch, "--pin", TEST_PIN_NAME]) as { cleaned?: boolean; path?: string };
    assertEquals(cleanup.cleaned, true, "cleanup should report cleaned");
    assertEquals(cleanup.path, stagedPath, "cleanup path should match stage path");
    assertEquals(existsSync(stagedPath), false, "staged path should be removed after cleanup");
  });

  await t.step("stage same branch reuses existing", () => {
    const pinName = scratchPinName("scratch-reuse");
    const branch = `${pinName}-branch`;
    try {
      createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
      runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
      const first = runGlMaintenanceJson(["stage", branch, "--pin", pinName]) as { created?: boolean; staged?: string };
      assertEquals(first.created, true, "first stage call should create clone");
      const second = runGlMaintenanceJson(["stage", branch, "--pin", pinName]) as { created?: boolean; staged?: string };
      assertEquals(second.created, false, "second stage call should reuse existing clone");
      assertEquals(second.staged, first.staged, "stage should reuse same path");
      runGlMaintenanceJson(["stage-cleanup", branch, "--pin", pinName]);
    } finally {
      ensurePinRemoved(pinName);
    }
  });

  await t.step("pin list includes the test pin", () => {
    const pins = runGlJson(["pin", "list"]) as { name?: string; source?: string; sha?: string }[];
    const pin = getPin(pins, TEST_PIN_NAME);
    assertExists(pin, "test pin should appear in pin list");
    assertEquals(pin!.name, TEST_PIN_NAME);
    assertEquals(pin!.source, TEST_SOURCE);
    assertEquals(!!pin!.sha, true, "pin sha should be populated");
  });

  await t.step("pin remove removes local pin data", () => {
    const pinName = scratchPinName("scratch-remove");
    try {
      const added = runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", TEST_MAIN_REF]) as { name?: string; sha?: string };
      assertEquals(added.name, pinName);
      assertEquals(existsSync(cloneDir(pinName, added.sha!)), true, "clone should create pin version");
      const removed = runGlJson(["pin", "remove", pinName]) as { removed?: boolean };
      assertEquals(removed.removed, true, "pin remove should report removed");
      assertEquals(getPin(runGlJson(["pin", "list"]), pinName), undefined, "pin should no longer exist");
      assertEquals(
        existsSync(path.join(Deno.cwd(), ".giterloper", "versions", pinName)),
        false,
        "pin versions directory should be removed"
      );
    } finally {
      ensurePinRemoved(pinName);
    }
  });

  await t.step("pin update advances pin sha", () => {
    const pinName = scratchPinName("scratch-update");
    const branchName = `${pinName}-branch`;
    try {
      runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", TEST_MAIN_REF]);
      const originalSha = (getPin(runGlJson(["pin", "list"]), pinName) as { sha?: string })!.sha!;
      const branchSha = createRemoteBranchFromMain(
        branchName,
        `knowledge/e2e-update_${RUN_ID}_${randomBytes(4).toString("hex")}.md`,
        `# Update marker for ${pinName}\n`
      );
      const update = runGlJson(["pin", "update", pinName, "--ref", branchName]) as {
        updated?: boolean;
        name?: string;
        oldSha?: string;
        newSha?: string;
      };
      assertEquals(update.updated, true, "pin update should report updated");
      assertEquals(update.name, pinName);
      assertEquals(update.oldSha, originalSha, "pin update should record previous SHA");
      assertEquals(update.newSha, branchSha, "pin update should update to branch SHA");
      const pin = getPin(runGlJson(["pin", "list"]), pinName) as { sha?: string };
      assertExists(pin, "pin should still exist after update");
      assertEquals(pin!.sha, branchSha, "pinned sha should match updated hash");
    } finally {
      ensurePinRemoved(pinName);
    }
  });

  await t.step("status returns pinned state", () => {
    const status = runGlMaintenanceJson(["status"]) as {
      pins?: { name?: string; cloneExists?: boolean; cloneAtExpectedSha?: boolean }[];
    };
    assertEquals(Array.isArray(status.pins), true, "status should include pins");
    assertEquals((status.pins?.length ?? 0) > 0, true, "status should include at least one pin");
    const pin = getPin(status.pins!, TEST_PIN_NAME) as {
      name?: string;
      cloneExists?: boolean;
      cloneAtExpectedSha?: boolean;
    } | undefined;
    assertExists(pin, "status should report test pin");
    assertEquals(pin!.name, TEST_PIN_NAME);
    assertEquals(pin!.cloneExists, true, "test pin clone should exist");
    assertEquals(pin!.cloneAtExpectedSha, true, "test pin clone should match pinned sha");
  });

  await t.step("teardown", async () => {
    try {
      runGlMaintenanceJson(["teardown", TEST_PIN_NAME]);
    } finally {
      cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, {
        pinName: TEST_PIN_NAME,
        branchName: WORKFLOW_BRANCH,
      });
    }
  });
});
