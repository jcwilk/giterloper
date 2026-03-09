/**
 * Unit tests for lib/paths.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  findProjectRoot,
  ensureDir,
  cloneDir,
  stagedDir,
} from "../../.cursor/skills/gl/dist/paths.js";

describe("findProjectRoot", () => {
  it("returns dir when .git exists", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "gl-test-"));
    try {
      mkdirSync(path.join(tmp, ".git"));
      assert.strictEqual(findProjectRoot(tmp), tmp);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
  it("walks up to find .git", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "gl-test-"));
    try {
      mkdirSync(path.join(tmp, ".git"));
      const sub = path.join(tmp, "a", "b", "c");
      mkdirSync(sub, { recursive: true });
      assert.strictEqual(findProjectRoot(sub), tmp);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
  it("returns null when no .git", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "gl-test-"));
    try {
      assert.strictEqual(findProjectRoot(tmp), null);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("ensureDir", () => {
  it("creates directory when missing", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "gl-test-"));
    const sub = path.join(tmp, "new-dir");
    try {
      ensureDir(sub);
      assert.ok(existsSync(sub));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
  it("does not fail when dir exists", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "gl-test-"));
    try {
      ensureDir(tmp);
      ensureDir(tmp); // no throw
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("cloneDir", () => {
  it("returns versionsDir/name/sha", () => {
    const state = {
      projectRoot: "/proj",
      rootDir: "/proj/.giterloper",
      versionsDir: "/proj/.giterloper/versions",
      stagedRoot: "/proj/.giterloper/staged",
      pinnedPath: "/proj/.giterloper/pinned.yaml",
      globalJson: false,
      gpuMode: null,
    };
    const pin = { name: "my-pin", source: "gh/repo", sha: "abc123" };
    assert.strictEqual(
      cloneDir(state, pin),
      "/proj/.giterloper/versions/my-pin/abc123"
    );
  });
});

describe("stagedDir", () => {
  it("returns stagedRoot/pinName/branchName", () => {
    const state = {
      projectRoot: "/proj",
      rootDir: "/proj/.giterloper",
      versionsDir: "/proj/.giterloper/versions",
      stagedRoot: "/proj/.giterloper/staged",
      pinnedPath: "/proj/.giterloper/pinned.yaml",
      globalJson: false,
      gpuMode: null,
    };
    assert.strictEqual(
      stagedDir(state, "my-pin", "main"),
      "/proj/.giterloper/staged/my-pin/main"
    );
  });
});
