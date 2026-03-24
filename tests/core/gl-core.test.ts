import { assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert";
import path from "node:path";

import { makeState, validateSessionId } from "../../lib/gl-core.ts";
import { GlError } from "../../lib/errors.ts";
import { sessionDir } from "../../lib/mcp-session-store.ts";
import { effectiveGiterloperSessionsRoot } from "../../lib/session-layout.ts";

const PROJECT_ROOT = path.resolve(Deno.cwd());

Deno.test("makeState with sessionId roots mutable paths under .giterloper/<sessionId>", () => {
  const state = makeState("abc123");
  assertEquals(state.projectRoot, PROJECT_ROOT);
  const sessionRoot = path.join(PROJECT_ROOT, ".giterloper", "abc123");
  assertEquals(state.rootDir, sessionRoot);
  assertEquals(state.versionsDir, path.join(sessionRoot, "versions"));
  assertEquals(state.stagedRoot, path.join(sessionRoot, "staged"));
  assertEquals(state.pinnedPath, path.join(sessionRoot, "pinned.yaml"));
  assertEquals(state.sessionId, "abc123");
  assertEquals(state.mcpTestMode, false);
});

Deno.test("makeState('_cli') returns paths under .giterloper/_cli/", () => {
  const state = makeState("_cli");
  const sessionRoot = path.join(PROJECT_ROOT, ".giterloper", "_cli");
  assertEquals(state.rootDir, sessionRoot);
  assertEquals(state.pinnedPath, path.join(sessionRoot, "pinned.yaml"));
  assertEquals(state.sessionId, "_cli");
});

Deno.test("makeState({ mcpTestMode: true }) uses .giterloper_test/<sessionId>", () => {
  const state = makeState("t1", { mcpTestMode: true });
  assertEquals(state.mcpTestMode, true);
  const sessionsBase = effectiveGiterloperSessionsRoot(PROJECT_ROOT, true);
  const sessionRoot = path.join(sessionsBase, "t1");
  assertEquals(state.rootDir, sessionRoot);
});

Deno.test("makeState mcp test mode + GITERLOPER_MCP_TEST_SESSION_PARENT keeps projectRoot as product root", () => {
  const tmp = Deno.makeTempDirSync();
  const key = "GITERLOPER_MCP_TEST_SESSION_PARENT";
  const prev = Deno.env.get(key);
  Deno.env.set(key, tmp);
  try {
    const state = makeState("t2", { mcpTestMode: true });
    assertEquals(state.projectRoot, PROJECT_ROOT);
    assertEquals(state.rootDir, path.join(tmp, ".giterloper_test", "t2"));
    assertEquals(sessionDir("t2", true), state.rootDir);
  } finally {
    if (prev === undefined) Deno.env.delete(key);
    else Deno.env.set(key, prev);
    Deno.removeSync(tmp, { recursive: true });
  }
});

Deno.test("makeState mcpTestSessionParent option overrides GITERLOPER_MCP_TEST_SESSION_PARENT", () => {
  const tmpEnv = Deno.makeTempDirSync();
  const tmpOpt = Deno.makeTempDirSync();
  const key = "GITERLOPER_MCP_TEST_SESSION_PARENT";
  const prev = Deno.env.get(key);
  Deno.env.set(key, tmpEnv);
  try {
    const state = makeState("t3", {
      mcpTestMode: true,
      mcpTestSessionParent: tmpOpt,
    });
    assertEquals(state.projectRoot, PROJECT_ROOT);
    assertEquals(state.rootDir, path.join(tmpOpt, ".giterloper_test", "t3"));
    assertEquals(
      sessionDir("t3", true, { mcpTestSessionParent: tmpOpt }),
      state.rootDir
    );
    assertNotEquals(state.rootDir, path.join(tmpEnv, ".giterloper_test", "t3"));
  } finally {
    if (prev === undefined) Deno.env.delete(key);
    else Deno.env.set(key, prev);
    Deno.removeSync(tmpEnv, { recursive: true });
    Deno.removeSync(tmpOpt, { recursive: true });
  }
});

Deno.test("makeState projectRoot option relocates product root and session anchor", () => {
  const tmpRoot = Deno.makeTempDirSync();
  const state = makeState("t4", {
    mcpTestMode: true,
    projectRoot: tmpRoot,
  });
  assertEquals(state.projectRoot, path.resolve(tmpRoot));
  assertEquals(
    state.rootDir,
    path.join(tmpRoot, ".giterloper_test", "t4")
  );
  Deno.removeSync(tmpRoot, { recursive: true });
});

Deno.test("makeState explicit projectRoot ignores GITERLOPER_MCP_TEST_SESSION_PARENT (harness case)", () => {
  const tmpRoot = Deno.makeTempDirSync();
  const tmpEnvParent = Deno.makeTempDirSync();
  const key = "GITERLOPER_MCP_TEST_SESSION_PARENT";
  const prev = Deno.env.get(key);
  Deno.env.set(key, tmpEnvParent);
  try {
    const state = makeState("t5", {
      mcpTestMode: true,
      projectRoot: tmpRoot,
    });
    assertEquals(state.rootDir, path.join(tmpRoot, ".giterloper_test", "t5"));
    assertNotEquals(state.rootDir, path.join(tmpEnvParent, ".giterloper_test", "t5"));
  } finally {
    if (prev === undefined) Deno.env.delete(key);
    else Deno.env.set(key, prev);
    Deno.removeSync(tmpRoot, { recursive: true });
    Deno.removeSync(tmpEnvParent, { recursive: true });
  }
});

Deno.test("validateSessionId accepts UUID-like sessionId", () => {
  const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  assertEquals(validateSessionId(id), id);
});

Deno.test("validateSessionId rejects empty", async () => {
  const err = (await assertRejects(
    async () => {
      validateSessionId("");
    },
    GlError
  )) as GlError;
  assertEquals(err.message.includes("sessionId"), true);
});

Deno.test("validateSessionId rejects invalid chars", async () => {
  const err = (await assertRejects(
    async () => {
      validateSessionId("bad..path");
    },
    GlError
  )) as GlError;
  assertEquals(err.message.includes("invalid characters"), true);
});
