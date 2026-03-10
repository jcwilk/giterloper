import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { findProjectRoot, ensureDir, cloneDir, stagedDir } from "../../lib/paths.ts";

describe("findProjectRoot", () => {
  it("returns current dir when .git exists", () => {
    const root = findProjectRoot("/workspace");
    assert.equal(root, "/workspace");
  });
  it("returns null when no .git in hierarchy", () => {
    const root = findProjectRoot(tmpdir());
    assert.equal(root, null);
  });
});

describe("ensureDir", () => {
  it("creates directory when missing", () => {
    const dir = path.join(tmpdir(), `paths-test-${Date.now()}`);
    try {
      assert.ok(!fs.existsSync(dir));
      ensureDir(dir);
      assert.ok(fs.existsSync(dir) && fs.statSync(dir).isDirectory());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("cloneDir", () => {
  it("returns versionsDir/name/sha", () => {
    const state = { versionsDir: "/proj/.giterloper/versions", stagedRoot: "/proj/.giterloper/staged" };
    const pin = { name: "p1", source: "x", sha: "abc123" };
    assert.equal(cloneDir(state, pin), "/proj/.giterloper/versions/p1/abc123");
  });
});

describe("stagedDir", () => {
  it("returns stagedRoot/pinName/branchName", () => {
    const state = { versionsDir: "/x", stagedRoot: "/proj/.giterloper/staged" };
    assert.equal(stagedDir(state, "p1", "main"), "/proj/.giterloper/staged/p1/main");
  });
});
