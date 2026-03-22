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

Deno.test("resolveMcpTestMode override wins over env", () => {
  const k = "GITERLOPER_MCP_TEST_MODE";
  const prev = Deno.env.get(k);
  Deno.env.set(k, "1");
  try {
    assertEquals(resolveMcpTestMode(false), false);
    assertEquals(resolveMcpTestMode(true), true);
  } finally {
    if (prev === undefined) Deno.env.delete(k);
    else Deno.env.set(k, prev);
  }
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
