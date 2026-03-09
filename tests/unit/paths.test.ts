/**
 * Unit tests for paths module.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  findProjectRoot,
  ensureDir,
  cloneDir,
  stagedDir,
} from "../../.cursor/skills/gl/dist/paths.js";
import type { GlState, Pin } from "../../.cursor/skills/gl/dist/types.js";

describe("findProjectRoot", () => {
  it("returns current dir when .git exists", () => {
    const root = findProjectRoot("/workspace");
    assert.strictEqual(root, "/workspace");
  });
  it("returns null when no .git in hierarchy", () => {
    const dir = mkdtempSync(join(tmpdir(), "gl-test-"));
    try {
      const root = findProjectRoot(dir);
      assert.strictEqual(root, null);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
  it("walks up to find .git", () => {
    const base = mkdtempSync(join(tmpdir(), "gl-test-"));
    const sub = join(base, "a", "b", "c");
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(base, ".git"), ""); // .git is usually a dir, but for test a file is enough to make existsSync true
    try {
      const root = findProjectRoot(sub);
      assert.strictEqual(root, base);
    } finally {
      rmSync(base, { recursive: true });
    }
  });
});

describe("ensureDir", () => {
  it("creates directory if missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gl-test-"));
    const sub = join(dir, "new", "nested");
    try {
      ensureDir(sub);
      assert.ok(existsSync(sub));
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe("cloneDir", () => {
  it("returns versionsDir/name/sha", () => {
    const state: GlState = {
      projectRoot: "/proj",
      rootDir: "/proj/.giterloper",
      versionsDir: "/proj/.giterloper/versions",
      stagedRoot: "/proj/.giterloper/staged",
      pinnedPath: "/proj/.giterloper/pinned.yaml",
      globalJson: false,
    };
    const pin: Pin = { name: "p1", source: "x", sha: "abc123" };
    assert.strictEqual(cloneDir(state, pin), "/proj/.giterloper/versions/p1/abc123");
  });
});

describe("stagedDir", () => {
  it("returns stagedRoot/pinName/branchName", () => {
    const state: GlState = {
      projectRoot: "/proj",
      rootDir: "/proj/.giterloper",
      versionsDir: "/proj/.giterloper/versions",
      stagedRoot: "/proj/.giterloper/staged",
      pinnedPath: "/proj/.giterloper/pinned.yaml",
      globalJson: false,
    };
    assert.strictEqual(stagedDir(state, "p1", "main"), "/proj/.giterloper/staged/p1/main");
  });
});
