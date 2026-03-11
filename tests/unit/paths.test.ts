import { assertEquals } from "jsr:@std/assert";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { ensureDir, cloneDir, stagedDir } from "../../lib/paths.ts";

Deno.test("ensureDir creates directory when missing", () => {
  const dir = path.join(tmpdir(), `paths-test-${Date.now()}`);
  try {
    assertEquals(existsSync(dir), false);
    ensureDir(dir);
    assertEquals(existsSync(dir) && Deno.statSync(dir).isDirectory, true);
  } finally {
    Deno.removeSync(dir, { recursive: true });
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
  };
  assertEquals(stagedDir(state, "p1", "main"), "/proj/.giterloper/staged/p1/main");
});
