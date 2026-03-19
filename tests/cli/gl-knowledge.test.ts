import { assertEquals, assertExists, assertMatch } from "jsr:@std/assert";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
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
} from "../helpers/config.ts";

import {
  giterloperSessionRoot,
  newTestCliSessionId,
  runGlJson as runGlJsonCli,
  runGlMaintenanceJson as runGlMaintenanceJsonCli,
} from "../helpers/gl.ts";
import { cleanupTestKnowledgeRepo } from "../helpers/cleanup.ts";

const RUN_ID = `${E2E_MARKER}${randomBytes(8).toString("hex")}`;

function getPin(
  state: { name?: string }[] | unknown,
  pinName: string
): { name?: string; source?: string; sha?: string } | undefined {
  const arr = Array.isArray(state) ? state : [];
  return arr.find((entry: { name?: string }) => entry.name === pinName);
}

const TEST_SESSION = newTestCliSessionId();

function glj(args: string[], o: { cwd?: string; stdin?: string | null } = {}) {
  return runGlJsonCli(args, { sessionId: TEST_SESSION, ...o });
}

function glm(args: string[], o: { cwd?: string } = {}) {
  return runGlMaintenanceJsonCli(args, { sessionId: TEST_SESSION, ...o });
}

function stagedDir(pinName: string, branch: string): string {
  return path.join(giterloperSessionRoot(Deno.cwd(), TEST_SESSION), "staged", pinName, branch);
}

function cloneDir(pinName: string, sha: string): string {
  return path.join(giterloperSessionRoot(Deno.cwd(), TEST_SESSION), "versions", pinName, sha);
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
  const pins = glj(["pin", "list"]);
  if (getPin(pins, pinName)) {
    glj(["pin", "remove", pinName]);
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

Deno.test("stage creates a working clone", () => {
  const pinName = scratchPinName("scratch-stage");
  const branch = `${pinName}-branch`;
  try {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const stageResult = glm(["stage", branch, "--pin", pinName]) as {
      created?: boolean;
      staged?: string;
    };
    assertEquals(stageResult.created, true, "stage should create branch for first run");
    const dir = stagedDir(pinName, branch);
    assertEquals(stageResult.staged, dir, "stage command should return expected path");
    assertEquals(existsSync(dir), true, "staged dir should exist");
    assertEquals(existsSync(path.join(dir, "CONSTITUTION.md")), true, "staged dir should contain repository files");
  } finally {
    ensurePinRemoved(pinName);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
  }
});

Deno.test("write content to staged clone", () => {
  const pinName = scratchPinName("scratch-write");
  const branch = `${pinName}-branch`;
  try {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const dir = stagedDir(pinName, branch);
    glm(["stage", branch, "--pin", pinName]);
    const filePath = path.join(dir, TEST_TOPIC_PATH);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, branchContentText(), "utf8");
    const content = readFileSync(filePath, "utf8");
    assertMatch(content, /Test Topic for E2E/);
    assertMatch(content, /e2e-topic-keyword/);
  } finally {
    ensurePinRemoved(pinName);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
  }
});

Deno.test("promote pushes and updates pin", () => {
  const pinName = scratchPinName("scratch-promote");
  const branch = `${pinName}-branch`;
  try {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const beforePins = glj(["pin", "list"]) as { name?: string; sha?: string }[];
    const beforePin = getPin(beforePins, pinName);
    assertExists(beforePin, "test pin should exist before promote");
    const dir = stagedDir(pinName, branch);
    glm(["stage", branch, "--pin", pinName]);
    const filePath = path.join(dir, TEST_TOPIC_PATH);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, branchContentText(), "utf8");
    glm(["promote", "--pin", pinName]);
    const afterPins = glj(["pin", "list"]) as { name?: string; sha?: string }[];
    const afterPin = getPin(afterPins, pinName);
    assertExists(afterPin, "test pin should exist after promote");
    assertEquals(afterPin!.sha !== beforePin!.sha, true, "pin sha should change after promote");
    assertEquals(existsSync(cloneDir(pinName, afterPin!.sha!)), true, "pinned clone should exist for new sha");
  } finally {
    ensurePinRemoved(pinName);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
  }
});

Deno.test("diagnostic reports healthy state (main gl)", () => {
  const pinName = scratchPinName("scratch-diagnostic");
  const branch = `${pinName}-branch`;
  try {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
    createRemoteBranchFromMain(branch, TEST_TOPIC_PATH, branchContentText());
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const result = glj(["diagnostic", "--pin", pinName]) as {
      ok?: boolean;
      checks?: { pin?: string; clonePresent?: boolean; cloneShaOk?: boolean }[];
    };
    assertEquals(result.ok, true, "diagnostic should report ok=true");
    assertEquals((result.checks?.length ?? 0) > 0, true, "diagnostic should include checks");
    const check = result.checks![0];
    assertEquals(check.pin, pinName, "check should target test pin");
    assertEquals(check.clonePresent, true, "clone should be present");
    assertEquals(check.cloneShaOk, true, "clone should match pinned sha");
  } finally {
    ensurePinRemoved(pinName);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
  }
});

Deno.test("verify reports healthy state (extended)", () => {
  const pinName = scratchPinName("scratch-verify");
  const branch = `${pinName}-branch`;
  try {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
    createRemoteBranchFromMain(branch, TEST_TOPIC_PATH, branchContentText());
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const result = glm(["verify", "--pin", pinName]) as {
      ok?: boolean;
      checks?: { pin?: string; clonePresent?: boolean; cloneShaOk?: boolean }[];
    };
    assertEquals(result.ok, true, "verify should report ok=true");
    assertEquals((result.checks?.length ?? 0) > 0, true, "verify should include checks");
    const check = result.checks![0];
    assertEquals(check.pin, pinName, "check should target test pin");
    assertEquals(check.clonePresent, true, "clone should be present");
    assertEquals(check.cloneShaOk, true, "clone should match pinned sha");
  } finally {
    ensurePinRemoved(pinName);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
  }
});

Deno.test("stage-cleanup removes staged clone", () => {
  const pinName = scratchPinName("scratch-cleanup");
  const branch = `${pinName}-branch`;
  try {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const staged = glm(["stage", branch, "--pin", pinName]) as { staged?: string };
    const stagedPath = staged.staged!;
    assertEquals(existsSync(stagedPath), true, "staged path should exist before cleanup");
    const cleanup = glm(["stage-cleanup", branch, "--pin", pinName]) as {
      cleaned?: boolean;
      path?: string;
    };
    assertEquals(cleanup.cleaned, true, "cleanup should report cleaned");
    assertEquals(cleanup.path, stagedPath, "cleanup path should match stage path");
    assertEquals(existsSync(stagedPath), false, "staged path should be removed after cleanup");
  } finally {
    ensurePinRemoved(pinName);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
  }
});

Deno.test("stage same branch reuses existing", () => {
  const pinName = scratchPinName("scratch-reuse");
  const branch = `${pinName}-branch`;
  try {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const first = glm(["stage", branch, "--pin", pinName]) as {
      created?: boolean;
      staged?: string;
    };
    assertEquals(first.created, true, "first stage call should create clone");
    const second = glm(["stage", branch, "--pin", pinName]) as {
      created?: boolean;
      staged?: string;
    };
    assertEquals(second.created, false, "second stage call should reuse existing clone");
    assertEquals(second.staged, first.staged, "stage should reuse same path");
    glm(["stage-cleanup", branch, "--pin", pinName]);
  } finally {
    ensurePinRemoved(pinName);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
  }
});

Deno.test("pin list includes the test pin", () => {
  const pinName = scratchPinName("scratch-list");
  const branch = `${pinName}-branch`;
  try {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
    createRemoteBranchFromMain(branch, TEST_TOPIC_PATH, branchContentText());
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const pins = glj(["pin", "list"]) as { name?: string; source?: string; sha?: string }[];
    const pin = getPin(pins, pinName);
    assertExists(pin, "test pin should appear in pin list");
    assertEquals(pin!.name, pinName);
    assertEquals(pin!.source, TEST_SOURCE);
    assertEquals(!!pin!.sha, true, "pin sha should be populated");
  } finally {
    ensurePinRemoved(pinName);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
  }
});

Deno.test("pin remove removes local pin data", () => {
  const pinName = scratchPinName("scratch-remove");
  try {
    const added = glj(["pin", "add", pinName, TEST_SOURCE, "--ref", TEST_MAIN_REF]) as {
      name?: string;
      sha?: string;
    };
    assertEquals(added.name, pinName);
    assertEquals(existsSync(cloneDir(pinName, added.sha!)), true, "clone should create pin version");
    const removed = glj(["pin", "remove", pinName]) as { removed?: boolean };
    assertEquals(removed.removed, true, "pin remove should report removed");
    assertEquals(getPin(glj(["pin", "list"]) as { name?: string }[], pinName), undefined, "pin should no longer exist");
    assertEquals(
      existsSync(path.join(giterloperSessionRoot(Deno.cwd(), TEST_SESSION), "versions", pinName)),
      false,
      "pin versions directory should be removed"
    );
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("pin update advances pin sha", () => {
  const pinName = scratchPinName("scratch-update");
  const branchName = `${pinName}-branch`;
  try {
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", TEST_MAIN_REF]);
    const originalSha = getPin(glj(["pin", "list"]) as { name?: string; sha?: string }[], pinName)!.sha!;
    const branchSha = createRemoteBranchFromMain(
      branchName,
      `knowledge/e2e-update_${RUN_ID}_${randomBytes(4).toString("hex")}.md`,
      `# Update marker for ${pinName}\n`
    );
    const update = glj(["pin", "update", pinName, "--ref", branchName]) as {
      updated?: boolean;
      name?: string;
      oldSha?: string;
      newSha?: string;
    };
    assertEquals(update.updated, true, "pin update should report updated");
    assertEquals(update.name, pinName);
    assertEquals(update.oldSha, originalSha, "pin update should record previous SHA");
    assertEquals(update.newSha, branchSha, "pin update should update to branch SHA");
    const pin = getPin(glj(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    assertExists(pin, "pin should still exist after update");
    assertEquals(pin!.sha, branchSha, "pinned sha should match updated hash");
  } finally {
    ensurePinRemoved(pinName);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName, sessionId: TEST_SESSION });
  }
});

Deno.test("status returns pinned state", () => {
  const pinName = scratchPinName("scratch-status");
  const branch = `${pinName}-branch`;
  try {
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
    createRemoteBranchFromMain(branch, TEST_TOPIC_PATH, branchContentText());
    glj(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    const status = glm(["status"]) as {
      pins?: { name?: string; cloneExists?: boolean; cloneAtExpectedSha?: boolean }[];
    };
    assertEquals(Array.isArray(status.pins), true, "status should include pins");
    assertEquals((status.pins?.length ?? 0) > 0, true, "status should include at least one pin");
    const pin = getPin(status.pins!, pinName) as {
      name?: string;
      cloneExists?: boolean;
      cloneAtExpectedSha?: boolean;
    } | undefined;
    assertExists(pin, "status should report test pin");
    assertEquals(pin!.name, pinName);
    assertEquals(pin!.cloneExists, true, "test pin clone should exist");
    assertEquals(pin!.cloneAtExpectedSha, true, "test pin clone should match pinned sha");
  } finally {
    ensurePinRemoved(pinName);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { pinName, branchName: branch, sessionId: TEST_SESSION });
  }
});
