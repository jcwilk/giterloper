import { assertEquals } from "jsr:@std/assert";
import path from "node:path";

import {
  effectiveKnowledgeStoreRemote,
  giterloperSessionsRoot,
  GITERLOPER_SESSION_BASE_NORMAL,
  GITERLOPER_SESSION_BASE_TEST,
  resolveMcpTestMode,
  sessionBaseSegment,
} from "../../lib/session-layout.ts";

Deno.test("session base segment literals are fixed (not env-derived)", () => {
  assertEquals(GITERLOPER_SESSION_BASE_NORMAL, ".giterloper");
  assertEquals(GITERLOPER_SESSION_BASE_TEST, ".giterloper_test");
  assertEquals(sessionBaseSegment(false), ".giterloper");
  assertEquals(sessionBaseSegment(true), ".giterloper_test");
  assertEquals(
    giterloperSessionsRoot("/tmp/proj", true),
    path.join("/tmp/proj", ".giterloper_test")
  );
});

Deno.test("resolveMcpTestMode is explicit only (no env inference)", () => {
  assertEquals(resolveMcpTestMode(), false);
  assertEquals(resolveMcpTestMode(undefined), false);
  assertEquals(resolveMcpTestMode(false), false);
  assertEquals(resolveMcpTestMode(true), true);
});

Deno.test("effectiveKnowledgeStoreRemote reads mode-appropriate env key", () => {
  const fakeEnv = (m: Record<string, string>) => ({
    get(key: string): string | undefined {
      return m[key];
    },
  });
  assertEquals(
    effectiveKnowledgeStoreRemote(false, undefined, fakeEnv({ KNOWLEDGE_STORE_REMOTE: " https://prod " })),
    "https://prod"
  );
  assertEquals(
    effectiveKnowledgeStoreRemote(true, undefined, fakeEnv({ TEST_KNOWLEDGE_STORE_REMOTE: "https://test" })),
    "https://test"
  );
  assertEquals(
    effectiveKnowledgeStoreRemote(true, undefined, fakeEnv({ KNOWLEDGE_STORE_REMOTE: "only-normal" })),
    undefined
  );
});

Deno.test("effectiveKnowledgeStoreRemote null override skips env", () => {
  const fakeEnv = (m: Record<string, string>) => ({
    get(key: string): string | undefined {
      return m[key];
    },
  });
  assertEquals(
    effectiveKnowledgeStoreRemote(false, null, fakeEnv({ KNOWLEDGE_STORE_REMOTE: "x" })),
    undefined
  );
});
