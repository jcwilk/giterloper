import { assertEquals } from "jsr:@std/assert";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { ensureDir, cloneDir, stagedDir, indexDir } from "../../lib/paths.ts";

Deno.test("ensureDir creates directory when missing", () => {
  const dir = path.join(tmpdir(), `paths-test-${randomBytes(8).toString("hex")}`);
  try {
    assertEquals(existsSync(dir), false);
    ensureDir(dir);
    assertEquals(existsSync(dir) && Deno.statSync(dir).isDirectory, true);
  } finally {
    try {
      Deno.removeSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
});

Deno.test("cloneDir returns versionsDir/name/sha", () => {
  const sessionRoot = "/proj/.giterloper/test";
  const state = {
    projectRoot: "/proj",
    rootDir: sessionRoot,
    versionsDir: `${sessionRoot}/versions`,
    stagedRoot: `${sessionRoot}/staged`,
    pinnedPath: `${sessionRoot}/pinned.yaml`,
    globalJson: false,
    sessionId: "test",
    mcpTestMode: false,
  };
  const pin = { name: "p1", source: "x", sha: "abc123" };
  assertEquals(cloneDir(state, pin), "/proj/.giterloper/test/versions/p1/abc123");
});

Deno.test("stagedDir returns stagedRoot/pinName/branchName", () => {
  const sessionRoot = "/proj/.giterloper/test";
  const state = {
    projectRoot: "/proj",
    rootDir: sessionRoot,
    versionsDir: "/x",
    stagedRoot: `${sessionRoot}/staged`,
    pinnedPath: `${sessionRoot}/pinned.yaml`,
    globalJson: false,
    sessionId: "test",
    mcpTestMode: false,
  };
  assertEquals(stagedDir(state, "p1", "main"), "/proj/.giterloper/test/staged/p1/main");
});

Deno.test("indexDir returns rootDir/indexes/pinName/sha", () => {
  const sessionRoot = "/proj/.giterloper/test";
  const state = {
    projectRoot: "/proj",
    rootDir: sessionRoot,
    versionsDir: "/x",
    stagedRoot: "/x",
    pinnedPath: `${sessionRoot}/pinned.yaml`,
    globalJson: false,
    sessionId: "test",
    mcpTestMode: false,
  };
  assertEquals(
    indexDir(state, "knowledge", "abcd1234".repeat(5)),
    "/proj/.giterloper/test/indexes/knowledge/abcd1234abcd1234abcd1234abcd1234abcd1234"
  );
});
