/**
 * Unit tests for lib/paths.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { findProjectRoot, cloneDir, stagedDir } from "../../.cursor/skills/gl/dist/paths.js";

function makeTempDir(): string {
  const dir = path.join(tmpdir(), `paths-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("findProjectRoot", () => {
  it("finds .git in current dir", () => {
    const root = makeTempDir();
    mkdirSync(path.join(root, ".git"));
    try {
      assert.strictEqual(findProjectRoot(root), root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("finds .git in parent", () => {
    const root = makeTempDir();
    mkdirSync(path.join(root, ".git"));
    const sub = path.join(root, "a", "b", "c");
    mkdirSync(sub, { recursive: true });
    try {
      assert.strictEqual(findProjectRoot(sub), root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns null when no .git", () => {
    const dir = makeTempDir();
    try {
      assert.strictEqual(findProjectRoot(dir), null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("cloneDir", () => {
  it("returns versionsDir/name/sha", () => {
    const state = {
      projectRoot: "/x",
      rootDir: "/x/.giterloper",
      versionsDir: "/x/.giterloper/versions",
      stagedRoot: "/x/.giterloper/staged",
      pinnedPath: "/x/.giterloper/pinned.yaml",
      globalJson: false,
      gpuMode: null as string | null,
    };
    const pin = { name: "k", source: "x", sha: "a".repeat(40) };
    assert.strictEqual(cloneDir(state, pin), "/x/.giterloper/versions/k/" + "a".repeat(40));
  });
});

describe("stagedDir", () => {
  it("returns stagedRoot/pinName/branchName", () => {
    const state = {
      projectRoot: "/x",
      rootDir: "/x/.giterloper",
      versionsDir: "/x/.giterloper/versions",
      stagedRoot: "/x/.giterloper/staged",
      pinnedPath: "/x/.giterloper/pinned.yaml",
      globalJson: false,
      gpuMode: null as string | null,
    };
    assert.strictEqual(stagedDir(state, "k", "main"), "/x/.giterloper/staged/k/main");
  });
});
