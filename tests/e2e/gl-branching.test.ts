import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { assertThrows } from "jsr:@std/assert";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

import {
  CLEAN_MAIN_SHA,
  E2E_MARKER,
  TEST_ADD_CONTENT,
  TEST_MAIN_REF,
  TEST_SOURCE,
  toRemoteUrl,
} from "./config.ts";
import { cleanupTestKnowledgeRepo } from "../helpers/cleanup.ts";
import { runGl, runGlMaintenance, runGlMaintenanceJson, runGlJson } from "../helpers/gl.ts";

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

function pinByName(list: { name?: string; sha?: string }[] | null | undefined, name: string) {
  return Array.isArray(list) ? list.find((p) => p.name === name) : undefined;
}

function ensurePinRemoved(name: string): void {
  const pins = (runGlJson(["pin", "list"]) ?? []) as { name?: string }[];
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

function pushCommitToBranch(
  branch: string,
  contentPath: string,
  contentBody: string
): void {
  const tempRoot = Deno.makeTempDirSync({ prefix: "giterloper-stale-" });
  const repoDir = path.join(tempRoot, "repo");
  try {
    runGit(["clone", "--quiet", toRemoteUrl(TEST_SOURCE), repoDir]);
    runGit(["checkout", branch], { cwd: repoDir });
    runGit(["config", "user.name", "giterloper-test"], { cwd: repoDir });
    runGit(["config", "user.email", "giterloper-test@example.com"], { cwd: repoDir });
    const fullPath = path.join(repoDir, contentPath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, contentBody, "utf8");
    runGit(["add", path.relative(repoDir, fullPath)], { cwd: repoDir });
    runGit(["commit", "-m", `stale update ${Date.now()}`], { cwd: repoDir });
    runGit(["push", "origin", `HEAD:${branch}`], { cwd: repoDir });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

Deno.test("add fails for branchless pin", () => {
  const branchlessPin = randomPin("branchless");
  try {
    runGlJson(["pin", "add", branchlessPin, TEST_SOURCE, "--ref", TEST_MAIN_REF]);
    assertThrows(
      () => runGl(["add", "--pin", branchlessPin], { stdin: "x" }),
      Error,
      "has no branch"
    );
  } finally {
    ensurePinRemoved(branchlessPin);
  }
});

Deno.test("promote fails for branchless pin", () => {
  const branchlessPin = randomPin("branchless");
  try {
    runGlJson(["pin", "add", branchlessPin, TEST_SOURCE, "--ref", TEST_MAIN_REF]);
    assertThrows(
      () => runGlMaintenance(["promote", "--pin", branchlessPin]),
      Error,
      "has no branch"
    );
  } finally {
    ensurePinRemoved(branchlessPin);
  }
});

Deno.test("pin add with non-existent branch creates pin and clones from ref", () => {
  const pinName = randomPin("create-branch");
  const branch = `${pinName}-branch`;
  try {
    const result = runGlJson([
      "pin",
      "add",
      pinName,
      TEST_SOURCE,
      "--ref",
      TEST_MAIN_REF,
      "--branch",
      branch,
    ]) as { name?: string; branch?: string; ref?: string; sha?: string };
    assertEquals(result.name, pinName);
    assertEquals(result.branch, branch);
    assertEquals(result.ref, TEST_MAIN_REF);
    assertEquals(/^[0-9a-f]{40}$/i.test(result.sha ?? ""), true, "pin sha should be 40-char hex");
    const pin = pinByName(runGlJson(["pin", "list"]) as { name?: string }[], pinName);
    assertEquals(!!pin, true, "pin should exist after add");
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("add on newly created branch creates remote branch on first push", () => {
  const pinName = randomPin("create-on-push");
  const branch = `${pinName}-branch`;
  try {
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", TEST_MAIN_REF, "--branch", branch]);
    const addResult = runGlJson(["add", "--pin", pinName, "--name", "first-push"], {
      stdin: "# first",
    }) as { action?: string; sha?: string };
    assertEquals(addResult.action, "added");
    assertEquals(!!addResult.sha, true, "add should advance pin sha");
    const pin = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], pinName);
    assertEquals(pin!.sha, addResult.sha);
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("add fails before staged copy when branch exists and pin SHA mismatches remote", () => {
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
    assertThrows(
      () => runGl(["add", "--pin", pinName], { stdin: "should fail" }),
      Error,
      "does not match"
    );
    const stagedPath = stagedDir(pinName, branch);
    assertEquals(existsSync(stagedPath), false, "staged copy should not exist after fail-fast");
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("stage fails before clone when branch exists and pin SHA mismatches remote", () => {
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
    assertThrows(
      () => runGlMaintenance(["stage", branch, "--pin", pinName]),
      Error,
      "does not match"
    );
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("add succeeds when branch exists and pin SHA matches remote", () => {
  const pinName = randomPin("match-flow");
  const branch = `${pinName}-branch`;
  try {
    createRemoteBranchFromMain(branch, "knowledge/scratch.md", "# scratch");
    runGlJson(["pin", "add", pinName, TEST_SOURCE, "--ref", branch, "--branch", branch]);
    runGlMaintenanceJson(["stage", branch, "--pin", pinName]);
    const result = runGlJson(["add", "--pin", pinName], { stdin: TEST_ADD_CONTENT }) as {
      action?: string;
      file?: string;
    };
    assertEquals(result.action, "added");
    const filePath = path.join(stagedDir(pinName, branch), "added", result.file!);
    assertEquals(existsSync(filePath), true);
  } finally {
    ensurePinRemoved(pinName);
  }
});

Deno.test("merge merges source pin branch into target via GitHub API", () => {
  const srcBranch = `${RUN_ID}_merge_src`;
  const tgtBranch = `${RUN_ID}_merge_tgt`;
  const srcPin = randomPin("merge-src");
  const tgtPin = randomPin("merge-tgt");
  try {
    createRemoteBranchFromMain(
      srcBranch,
      `knowledge/e2e_${RUN_ID}_merge_src.md`,
      `# Merge source\n\nmerge-src-marker-${RUN_ID}`
    );
    createRemoteBranchFromMain(
      tgtBranch,
      `knowledge/e2e_${RUN_ID}_merge_tgt.md`,
      `# Merge target\n\nmerge-tgt-marker-${RUN_ID}`
    );
    runGlJson(["pin", "add", srcPin, TEST_SOURCE, "--ref", srcBranch, "--branch", srcBranch]);
    runGlJson(["pin", "add", tgtPin, TEST_SOURCE, "--ref", tgtBranch, "--branch", tgtBranch]);
    const beforeTgt = pinByName(runGlJson(["pin", "list"]) as { name?: string; sha?: string }[], tgtPin);
    assertEquals(!!beforeTgt?.sha, true);
    const mergeResult = runGlJson(["merge", srcPin, tgtPin]) as {
      action?: string;
      target?: { pin?: string; oldSha?: string; newSha?: string };
    };
    assertEquals(mergeResult.action, "merged");
    assertEquals(mergeResult.target?.oldSha, beforeTgt!.sha);
    assert(mergeResult.target?.newSha !== beforeTgt!.sha, "target sha should advance after merge");
  } finally {
    ensurePinRemoved(srcPin);
    ensurePinRemoved(tgtPin);
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { branchName: srcBranch });
    cleanupTestKnowledgeRepo(TEST_SOURCE, CLEAN_MAIN_SHA, { branchName: tgtBranch });
  }
});
