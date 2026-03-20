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
});

Deno.test("makeState('_cli') returns paths under .giterloper/_cli/", () => {
  const state = makeState("_cli");
  const sessionRoot = path.join(PROJECT_ROOT, ".giterloper", "_cli");
  assertEquals(state.rootDir, sessionRoot);
  assertEquals(state.pinnedPath, path.join(sessionRoot, "pinned.yaml"));
  assertEquals(state.sessionId, "_cli");
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
