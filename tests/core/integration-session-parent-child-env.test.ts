/**
 * Locks subprocess env merge for MCP test mode: children must see
 * `GITERLOPER_MCP_TEST_SESSION_PARENT` when the harness (or manual runs) set it.
 * Same merge pattern as `runGl` / `runGlMaintenance` (`tests/helpers/gl.ts`) and
 * MCP integration spawns (`tests/helpers/mcp-subprocess.ts`). Normative layout:
 * core slice (sessionsParent / `.giterloper_test`; tests/README pairing).
 */
import { spawnSync } from "node:child_process";

import { assertEquals } from "jsr:@std/assert";

import { GITERLOPER_MCP_TEST_SESSION_PARENT } from "../../lib/session-layout.ts";
import { integrationMcpModeChildEnv } from "../helpers/integration-mcp-env.ts";

/** Mirrors `tests/helpers/gl.ts` (`runGl` / `runGlMaintenance`) and MCP spawn helpers. */
function integrationSpawnEnv(): Record<string, string> {
  return { ...Deno.env.toObject(), ...integrationMcpModeChildEnv() };
}

Deno.test("integration spawn env forwards GITERLOPER_MCP_TEST_SESSION_PARENT to child process", () => {
  const key = GITERLOPER_MCP_TEST_SESSION_PARENT;
  const val = Deno.makeTempDirSync();
  const prev = Deno.env.get(key);
  Deno.env.set(key, val);
  try {
    const env = integrationSpawnEnv();
    const r = spawnSync("printenv", [key], { env, encoding: "utf8" });
    assertEquals(r.status, 0, r.stderr);
    assertEquals((r.stdout as string).trim(), val);
  } finally {
    if (prev === undefined) Deno.env.delete(key);
    else Deno.env.set(key, prev);
  }
});
