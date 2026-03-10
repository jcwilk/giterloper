import { assertEquals, assert } from "jsr:@std/assert";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { findProjectRoot, ensureDir, cloneDir, stagedDir } from "../../lib/paths.ts";

Deno.test("findProjectRoot returns current dir when .git exists", () => {
  const root = findProjectRoot("/workspace");
  assertEquals(root, "/workspace");
});

Deno.test("findProjectRoot returns null when no .git in hierarchy", () => {
  const root = findProjectRoot(tmpdir());
  assertEquals(root, null);
});

Deno.test("ensureDir creates directory when missing", () => {
  const dir = path.join(tmpdir(), `paths-test-${Date.now()}`);
  try {
    assert(!existsSync(dir));
    ensureDir(dir);
    assert(existsSync(dir));
  } finally {
    try {
      Deno.removeSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
});

Deno.test("cloneDir returns versionsDir/name/sha", () => {
  const state = {
    projectRoot: "/proj",
    rootDir: "/proj/.giterloper",
    versionsDir: "/proj/.giterloper/versions",
    stagedRoot: "/proj/.giterloper/staged",
    pinnedPath: "/proj/.giterloper/pinned.yaml",
    globalJson: false,
    gpuMode: null,
  };
  const pin = { name: "p1", source: "x", sha: "abc123" };
  assertEquals(cloneDir(state, pin), "/proj/.giterloper/versions/p1/abc123");
});

Deno.test("stagedDir returns stagedRoot/pinName/branchName", () => {
  const state = {
    projectRoot: "/proj",
    rootDir: "/proj/.giterloper",
    versionsDir: "/x",
    stagedRoot: "/proj/.giterloper/staged",
    pinnedPath: "/proj/.giterloper/pinned.yaml",
    globalJson: false,
    gpuMode: null,
  };
  assertEquals(stagedDir(state, "p1", "main"), "/proj/.giterloper/staged/p1/main");
});
