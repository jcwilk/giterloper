import { assertEquals, assertThrows } from "jsr:@std/assert";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import type { GlState, Pin } from "../../lib/types.ts";
import { retrieveFileContent } from "../../lib/read-tools.ts";
import { ensureDir } from "../../lib/paths.ts";
import { run } from "../../lib/run.ts";

function makeState(rootDir: string): GlState {
  return {
    projectRoot: path.dirname(rootDir),
    rootDir,
    versionsDir: path.join(rootDir, "versions"),
    stagedRoot: path.join(rootDir, "staged"),
    pinnedPath: path.join(rootDir, "pinned.yaml"),
    globalJson: false,
    sessionId: "test",
  };
}

const SHA40 = "a".repeat(40);

function initGitRepo(dir: string, filePath: string, content: string): string {
  ensureDir(path.dirname(path.join(dir, filePath)));
  writeFileSync(path.join(dir, filePath), content, "utf8");
  run("git", ["init"], { cwd: dir });
  run("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  run("git", ["config", "user.name", "Test"], { cwd: dir });
  run("git", ["add", filePath], { cwd: dir });
  run("git", ["commit", "-m", "add file"], { cwd: dir });
  return run("git", ["rev-parse", "HEAD"], { cwd: dir });
}

function uniqueRoot(): string {
  return path.join(tmpdir(), `read-tools-${randomBytes(8).toString("hex")}`);
}

Deno.test("retrieveFileContent returns file content when clone exists at sha", () => {
  const root = uniqueRoot();
  const state = makeState(root);
  ensureDir(state.versionsDir);
  const pinName = "kb";
  const cloneParent = path.join(state.versionsDir, pinName);
  mkdirSync(cloneParent, { recursive: true });
  const clonePath = path.join(cloneParent, "temp");
  mkdirSync(clonePath, { recursive: true });
  const sha = initGitRepo(clonePath, "knowledge/foo.md", "# Hello\n\nContent here.\n");
  const finalClonePath = path.join(cloneParent, sha);
  Deno.renameSync(clonePath, finalClonePath);
  const pin: Pin = { name: pinName, source: "https://x/y", sha };
  try {
    const content = retrieveFileContent(state, pin, sha, "knowledge/foo.md");
    assertEquals(content, "# Hello\n\nContent here.\n");
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("retrieveFileContent throws when clone is missing", () => {
  const root = uniqueRoot();
  ensureDir(root);
  const state = makeState(root);
  const pin: Pin = { name: "kb", source: "https://x/y", sha: SHA40 };
  try {
    const err = assertThrows(
      () => retrieveFileContent(state, pin, SHA40, "knowledge/foo.md"),
      Error
    );
    assertEquals(err.message.includes("No clone for pin"), true);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("retrieveFileContent throws when path escapes clone directory", () => {
  const root = uniqueRoot();
  const state = makeState(root);
  ensureDir(state.versionsDir);
  const pinName = "kb";
  const cloneParent = path.join(state.versionsDir, pinName);
  mkdirSync(cloneParent, { recursive: true });
  const clonePath = path.join(cloneParent, "temp");
  mkdirSync(clonePath, { recursive: true });
  const sha = initGitRepo(clonePath, "knowledge/foo.md", "# x");
  const finalClonePath = path.join(cloneParent, sha);
  Deno.renameSync(clonePath, finalClonePath);
  const pin: Pin = { name: pinName, source: "https://x/y", sha };
  try {
    const err = assertThrows(
      () => retrieveFileContent(state, pin, sha, "../../../etc/passwd"),
      Error
    );
    assertEquals(err.message.includes("Path escapes clone directory"), true);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("retrieveFileContent throws when file not found", () => {
  const root = uniqueRoot();
  const state = makeState(root);
  ensureDir(state.versionsDir);
  const pinName = "kb";
  const cloneParent = path.join(state.versionsDir, pinName);
  mkdirSync(cloneParent, { recursive: true });
  const clonePath = path.join(cloneParent, "temp");
  mkdirSync(clonePath, { recursive: true });
  const sha = initGitRepo(clonePath, "knowledge/foo.md", "# x");
  const finalClonePath = path.join(cloneParent, sha);
  Deno.renameSync(clonePath, finalClonePath);
  const pin: Pin = { name: pinName, source: "https://x/y", sha };
  try {
    const err = assertThrows(
      () => retrieveFileContent(state, pin, sha, "knowledge/nonexistent.md"),
      Error
    );
    assertEquals(err.message.includes("File not found"), true);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});
