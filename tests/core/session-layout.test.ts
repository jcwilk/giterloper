import { assertEquals, assertNotEquals, assertThrows } from "jsr:@std/assert";
import path from "node:path";

import { GlError } from "../../lib/errors.ts";
import {
  effectiveGiterloperSessionsRoot,
  effectiveKnowledgeStoreRemote,
  effectiveMcpTestSessionParentOverride,
  GITERLOPER_MCP_TEST_SESSION_PARENT,
  giterloperSessionsRoot,
  GITERLOPER_SESSION_BASE_NORMAL,
  GITERLOPER_SESSION_BASE_TEST,
  resolveMcpTestMode,
  resolveProductRoot,
  resolveValidatedMcpTestSessionParent,
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

Deno.test("effectiveMcpTestSessionParentOverride: projectRoot alone implies trim-empty override", () => {
  assertEquals(
    effectiveMcpTestSessionParentOverride(true, { projectRoot: "/tmp/p" }),
    ""
  );
  assertEquals(effectiveMcpTestSessionParentOverride(false, { projectRoot: "/tmp/p" }), undefined);
});

Deno.test("effectiveMcpTestSessionParentOverride: explicit mcpTestSessionParent wins over projectRoot", () => {
  const alt = path.resolve("/tmp", "sess-par");
  assertEquals(
    effectiveMcpTestSessionParentOverride(true, {
      projectRoot: "/tmp/p",
      mcpTestSessionParent: alt,
    }),
    alt
  );
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

Deno.test("resolveProductRoot uses GITERLOPER_PROJECT_ROOT when set", () => {
  const fakeEnv = (m: Record<string, string>) => ({
    get(key: string): string | undefined {
      return m[key];
    },
  });
  assertEquals(
    resolveProductRoot(fakeEnv({ GITERLOPER_PROJECT_ROOT: "/abs/proj" }), () => "/tmp/cwd"),
    path.resolve("/abs/proj")
  );
  assertEquals(resolveProductRoot(fakeEnv({}), () => "/tmp/cwd"), path.resolve("/tmp/cwd"));
});

Deno.test("resolveValidatedMcpTestSessionParent resolves relative to anchor", () => {
  assertEquals(
    resolveValidatedMcpTestSessionParent("run-trees", "/repo/root"),
    path.resolve("/repo/root", "run-trees")
  );
});

Deno.test("resolveValidatedMcpTestSessionParent rejects .. segments", () => {
  assertThrows(
    () => resolveValidatedMcpTestSessionParent("a/../b", "/repo/root"),
    GlError
  );
});

Deno.test("resolveValidatedMcpTestSessionParent rejects NUL/newlines", () => {
  assertThrows(
    () => resolveValidatedMcpTestSessionParent("bad\npath", "/repo/root"),
    GlError
  );
});

Deno.test("effectiveGiterloperSessionsRoot ignores session parent when not MCP test mode", () => {
  const fakeEnv = (m: Record<string, string>) => ({
    get(key: string): string | undefined {
      return m[key];
    },
  });
  assertEquals(
    effectiveGiterloperSessionsRoot("/proj", false, fakeEnv({
      [GITERLOPER_MCP_TEST_SESSION_PARENT]: "/tmp/override",
    })),
    path.join("/proj", ".giterloper")
  );
});

Deno.test("effectiveGiterloperSessionsRoot uses session parent in MCP test mode", () => {
  const fakeEnv = (m: Record<string, string>) => ({
    get(key: string): string | undefined {
      return m[key];
    },
  });
  const alt = path.resolve("/tmp", "alt-parent");
  assertEquals(
    effectiveGiterloperSessionsRoot("/proj", true, fakeEnv({
      [GITERLOPER_MCP_TEST_SESSION_PARENT]: alt,
    })),
    path.join(alt, ".giterloper_test")
  );
});

Deno.test("effectiveGiterloperSessionsRoot explicit override wins over env in MCP test mode", () => {
  const fakeEnv = (m: Record<string, string>) => ({
    get(key: string): string | undefined {
      return m[key];
    },
  });
  const fromEnv = path.resolve("/tmp", "env-parent");
  const fromOverride = path.resolve("/tmp", "override-parent");
  assertEquals(
    effectiveGiterloperSessionsRoot("/proj", true, fakeEnv({
      [GITERLOPER_MCP_TEST_SESSION_PARENT]: fromEnv,
    }), fromOverride),
    path.join(fromOverride, ".giterloper_test")
  );
});

Deno.test("effectiveGiterloperSessionsRoot empty-string override ignores env in MCP test mode", () => {
  const fakeEnv = (m: Record<string, string>) => ({
    get(key: string): string | undefined {
      return m[key];
    },
  });
  const fromEnv = path.resolve("/tmp", "env-only");
  assertEquals(
    effectiveGiterloperSessionsRoot("/proj", true, fakeEnv({
      [GITERLOPER_MCP_TEST_SESSION_PARENT]: fromEnv,
    }), "   "),
    path.join("/proj", ".giterloper_test")
  );
});

Deno.test("effectiveGiterloperSessionsRoot relative session parent under project root", () => {
  const fakeEnv = (m: Record<string, string>) => ({
    get(key: string): string | undefined {
      return m[key];
    },
  });
  assertEquals(
    effectiveGiterloperSessionsRoot("/proj", true, fakeEnv({
      [GITERLOPER_MCP_TEST_SESSION_PARENT]: "sessions-run",
    })),
    path.join("/proj", "sessions-run", ".giterloper_test")
  );
});

Deno.test("different session parents yield different session dirs for the same sessionId (isolation)", () => {
  const fakeEnv = (m: Record<string, string>) => ({
    get(key: string): string | undefined {
      return m[key];
    },
  });
  const sessionId = "e2e_isolation_same_id_01";
  const parentA = path.resolve("/tmp", "giterloper-sess-parent-a");
  const parentB = path.resolve("/tmp", "giterloper-sess-parent-b");
  const productRoot = path.resolve("/tmp", "giterloper-product-root");
  const dirA = path.join(
    effectiveGiterloperSessionsRoot(productRoot, true, fakeEnv({
      [GITERLOPER_MCP_TEST_SESSION_PARENT]: parentA,
    })),
    sessionId
  );
  const dirB = path.join(
    effectiveGiterloperSessionsRoot(productRoot, true, fakeEnv({
      [GITERLOPER_MCP_TEST_SESSION_PARENT]: parentB,
    })),
    sessionId
  );
  assertNotEquals(dirA, dirB);
});

Deno.test("integrationMcpModeChildEnv forwards GITERLOPER_MCP_TEST_SESSION_PARENT when set", async () => {
  const { integrationMcpModeChildEnv } = await import("../helpers/integration-mcp-env.ts");
  const key = GITERLOPER_MCP_TEST_SESSION_PARENT;
  const prev = Deno.env.get(key);
  Deno.env.set(key, "/tmp/harness-session-parent");
  try {
    const merged = integrationMcpModeChildEnv();
    assertEquals(merged[key], "/tmp/harness-session-parent");
  } finally {
    if (prev === undefined) Deno.env.delete(key);
    else Deno.env.set(key, prev);
  }
});

Deno.test("integrationMcpModeChildEnv omits session parent when unset", async () => {
  const { integrationMcpModeChildEnv } = await import("../helpers/integration-mcp-env.ts");
  const key = GITERLOPER_MCP_TEST_SESSION_PARENT;
  const prev = Deno.env.get(key);
  try {
    Deno.env.delete(key);
    const merged = integrationMcpModeChildEnv();
    assertEquals(Object.hasOwn(merged, key), false);
  } finally {
    if (prev === undefined) Deno.env.delete(key);
    else Deno.env.set(key, prev);
  }
});
