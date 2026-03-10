import { assertEquals, assertExists } from "jsr:@std/assert";
import { existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
    assertEquals(existsSync(dir), false);
    ensureDir(dir);
    assertExists(existsSync(dir) && statSync(dir).isDirectory());
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("cloneDir returns versionsDir/name/sha", () => {
  const state = {
    versionsDir: "/proj/.giterloper/versions",
    stagedRoot: "/proj/.giterloper/staged",
  } as Parameters<typeof cloneDir>[0];
  const pin = { name: "p1", source: "x", sha: "abc123" };
  assertEquals(cloneDir(state, pin), "/proj/.giterloper/versions/p1/abc123");
});

Deno.test("stagedDir returns stagedRoot/pinName/branchName", () => {
  const state = {
    versionsDir: "/x",
    stagedRoot: "/proj/.giterloper/staged",
  } as Parameters<typeof stagedDir>[0];
  assertEquals(stagedDir(state, "p1", "main"), "/proj/.giterloper/staged/p1/main");
});
