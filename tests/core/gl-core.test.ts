import { assertEquals, assertRejects } from "jsr:@std/assert";
import path from "node:path";

import { makeState, validateSessionId } from "../../lib/gl-core.ts";
import { GlError } from "../../lib/errors.ts";

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
  const sessionRoot = path.join(PROJECT_ROOT, ".giterloper_test", "t1");
  assertEquals(state.rootDir, sessionRoot);
});

Deno.test("makeState follows GITERLOPER_MCP_TEST_MODE when option omitted", () => {
  const k = "GITERLOPER_MCP_TEST_MODE";
  const prev = Deno.env.get(k);
  Deno.env.set(k, "true");
  try {
    const state = makeState("env-sess");
    assertEquals(state.mcpTestMode, true);
    assertEquals(
      state.rootDir,
      path.join(PROJECT_ROOT, ".giterloper_test", "env-sess")
    );
  } finally {
    if (prev === undefined) Deno.env.delete(k);
    else Deno.env.set(k, prev);
  }
});

Deno.test("makeState explicit mcpTestMode false overrides truthy GITERLOPER_MCP_TEST_MODE", () => {
  const k = "GITERLOPER_MCP_TEST_MODE";
  const prev = Deno.env.get(k);
  Deno.env.set(k, "1");
  try {
    const state = makeState("override", { mcpTestMode: false });
    assertEquals(state.mcpTestMode, false);
    assertEquals(state.rootDir, path.join(PROJECT_ROOT, ".giterloper", "override"));
  } finally {
    if (prev === undefined) Deno.env.delete(k);
    else Deno.env.set(k, prev);
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
