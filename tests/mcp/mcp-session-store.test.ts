/**
 * Tests for MCP session store and cleanup. See ticket git-zdbt.
 */
import { assertEquals } from "jsr:@std/assert";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  isSafeSessionId,
  removeSessionData,
  scavengeStaleSessions,
  sessionDir,
  touchSession,
} from "../../lib/mcp-session-store.ts";

const RUN_ID = `mcp_ss_${randomBytes(8).toString("hex")}`;

/** Avoid scanning/deleting workspace `.giterloper/` (parallel harness + short-TTL scavenge). */
function withIsolatedProjectRootSync(fn: () => void): void {
  const tmp = Deno.makeTempDirSync();
  const prev = Deno.env.get("GITERLOPER_PROJECT_ROOT");
  Deno.env.set("GITERLOPER_PROJECT_ROOT", tmp);
  try {
    fn();
  } finally {
    if (prev === undefined) Deno.env.delete("GITERLOPER_PROJECT_ROOT");
    else Deno.env.set("GITERLOPER_PROJECT_ROOT", prev);
    try {
      Deno.removeSync(tmp, { recursive: true });
    } catch {
      // ignore
    }
  }
}

Deno.test("isSafeSessionId accepts valid sessionIds", () => {
  assertEquals(isSafeSessionId("abc123"), true);
  assertEquals(isSafeSessionId("a1b2c3d4-e5f6-7890-abcd-ef1234567890"), true);
  assertEquals(isSafeSessionId("x_y-z"), true);
});

Deno.test("isSafeSessionId rejects invalid inputs", () => {
  assertEquals(isSafeSessionId(null), false);
  assertEquals(isSafeSessionId(undefined), false);
  assertEquals(isSafeSessionId(""), false);
  assertEquals(isSafeSessionId("  "), false);
  assertEquals(isSafeSessionId("bad..path"), false);
  assertEquals(isSafeSessionId("bad/path"), false);
});

Deno.test("sessionDir returns path under .giterloper/<sessionId>", () => {
  withIsolatedProjectRootSync(() => {
    const id = "test-session";
    const dir = sessionDir(id);
    assertEquals(dir.endsWith(path.join(".giterloper", "test-session")), true);
  });
});

Deno.test("touchSession creates dir and last_activity file, removeSessionData cleans up", () => {
  withIsolatedProjectRootSync(() => {
    const sessionId = `${RUN_ID}_touch_remove`;
    const dir = sessionDir(sessionId);
    try {
      touchSession(sessionId);
      assertEquals(existsSync(dir), true);
      assertEquals(existsSync(path.join(dir, ".last_activity")), true);

      removeSessionData(sessionId);
      assertEquals(existsSync(dir), false);
    } finally {
      removeSessionData(sessionId);
    }
  });
});

Deno.test("removeSessionData is no-op for invalid sessionId", () => {
  // Should not throw
  removeSessionData(null);
  removeSessionData(undefined);
  removeSessionData("");
  removeSessionData("..");
});

Deno.test("removeSessionData is no-op when dir does not exist", () => {
  withIsolatedProjectRootSync(() => {
    removeSessionData(`${RUN_ID}_nonexistent_${randomBytes(4).toString("hex")}`);
  });
});

Deno.test("scavengeStaleSessions removes sessions older than TTL", () => {
  withIsolatedProjectRootSync(() => {
    const sessionId = `${RUN_ID}_stale_${randomBytes(4).toString("hex")}`;
    const dir = sessionDir(sessionId);
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, ".last_activity"), "1", "utf8"); // Very old timestamp

      const removed = scavengeStaleSessions(1000); // 1 second TTL
      assertEquals(removed >= 1, true);
      assertEquals(existsSync(dir), false);
    } finally {
      if (existsSync(dir)) {
        removeSessionData(sessionId);
      }
    }
  });
});

Deno.test("scavengeStaleSessions returns 0 when TTL is 0", () => {
  withIsolatedProjectRootSync(() => {
    assertEquals(scavengeStaleSessions(0), 0);
  });
});
