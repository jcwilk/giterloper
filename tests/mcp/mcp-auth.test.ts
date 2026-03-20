import { assertEquals } from "jsr:@std/assert";
import {
  extractBearerToken,
  isReadTool,
  isWriteTool,
  MCP_READ_TOOLS,
  MCP_WRITE_TOOLS,
  type McpAuthRuntime,
  UNAUTHORIZED_ENVELOPE,
  validateAuth,
} from "../../lib/mcp-auth.ts";

Deno.test("MCP_READ_TOOLS and MCP_WRITE_TOOLS are disjoint", () => {
  const writeNames = new Set(MCP_WRITE_TOOLS as readonly string[]);
  for (const r of MCP_READ_TOOLS) {
    assertEquals(writeNames.has(r), false, `read tool ${r} should not be in write`);
  }
});

Deno.test("isReadTool identifies read tools", () => {
  assertEquals(isReadTool("giterloper_search"), true);
  assertEquals(isReadTool("giterloper_retrieve"), true);
  assertEquals(isReadTool("giterloper_state_inspect"), true);
  assertEquals(isReadTool("giterloper_insert_pending"), false);
  assertEquals(isReadTool("giterloper_merge"), false);
  assertEquals(isReadTool("giterloper_reconcile_pending"), false);
  assertEquals(isReadTool("unknown"), false);
});

Deno.test("isWriteTool identifies write tools", () => {
  assertEquals(isWriteTool("giterloper_insert_pending"), true);
  assertEquals(isWriteTool("giterloper_merge"), true);
  assertEquals(isWriteTool("giterloper_reconcile_pending"), true);
  assertEquals(isWriteTool("giterloper_search"), false);
  assertEquals(isWriteTool("giterloper_retrieve"), false);
  assertEquals(isWriteTool("unknown"), false);
});

Deno.test("extractBearerToken extracts token from header", () => {
  assertEquals(extractBearerToken("Bearer abc123"), "abc123");
  assertEquals(extractBearerToken("Bearer  xyz "), "xyz");
  assertEquals(extractBearerToken("Bearer "), null);
  assertEquals(extractBearerToken("Basic abc123"), null);
  assertEquals(extractBearerToken(undefined), null);
  assertEquals(extractBearerToken(""), null);
});

Deno.test("UNAUTHORIZED_ENVELOPE has deterministic shape", () => {
  assertEquals(UNAUTHORIZED_ENVELOPE.ok, false);
  assertEquals(UNAUTHORIZED_ENVELOPE.code, "unauthorized");
  assertEquals(UNAUTHORIZED_ENVELOPE.message, "Authentication required");
  assertEquals(UNAUTHORIZED_ENVELOPE.details, {});
});

Deno.test("validateAuth allows when insecure mode", () => {
  const rt: McpAuthRuntime = { insecure: true, expectedToken: null };
  assertEquals(validateAuth(undefined, rt), true);
  assertEquals(validateAuth("Bearer wrong", rt), true);
});

Deno.test("validateAuth requires token when expectedToken set", () => {
  const rt: McpAuthRuntime = { insecure: false, expectedToken: "secret123" };
  assertEquals(validateAuth(undefined, rt), false);
  assertEquals(validateAuth("Bearer wrong", rt), false);
  assertEquals(validateAuth("Bearer secret123", rt), true);
});

Deno.test("validateAuth denies when not insecure and no expectedToken", () => {
  const rt: McpAuthRuntime = { insecure: false, expectedToken: null };
  assertEquals(validateAuth(undefined, rt), false);
  assertEquals(validateAuth("Bearer anything", rt), false);
});
