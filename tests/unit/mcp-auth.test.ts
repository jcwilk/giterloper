import { assertEquals } from "jsr:@std/assert";
import {
  extractBearerToken,
  isReadTool,
  isWriteTool,
  MCP_READ_TOOLS,
  MCP_WRITE_TOOLS,
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
  assertEquals(isReadTool("giterloper_reconcile"), false);
  assertEquals(isReadTool("giterloper_reconcile_pending"), false);
  assertEquals(isReadTool("unknown"), false);
});

Deno.test("isWriteTool identifies write tools", () => {
  assertEquals(isWriteTool("giterloper_insert_pending"), true);
  assertEquals(isWriteTool("giterloper_reconcile"), true);
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

Deno.test("validateAuth allows when MCP_INSECURE=true", async () => {
  const orig = Deno.env.get("MCP_INSECURE");
  const origToken = Deno.env.get("MCP_TOKEN");
  try {
    Deno.env.set("MCP_INSECURE", "true");
    Deno.env.delete("MCP_TOKEN");
    assertEquals(validateAuth(undefined), true);
    assertEquals(validateAuth("Bearer wrong"), true);
  } finally {
    if (orig !== undefined) Deno.env.set("MCP_INSECURE", orig);
    else Deno.env.delete("MCP_INSECURE");
    if (origToken !== undefined) Deno.env.set("MCP_TOKEN", origToken);
    else Deno.env.delete("MCP_TOKEN");
  }
});

Deno.test("validateAuth requires token when MCP_TOKEN set", async () => {
  const orig = Deno.env.get("MCP_INSECURE");
  const origToken = Deno.env.get("MCP_TOKEN");
  try {
    Deno.env.delete("MCP_INSECURE");
    Deno.env.set("MCP_TOKEN", "secret123");
    assertEquals(validateAuth(undefined), false);
    assertEquals(validateAuth("Bearer wrong"), false);
    assertEquals(validateAuth("Bearer secret123"), true);
  } finally {
    if (orig !== undefined) Deno.env.set("MCP_INSECURE", orig);
    else Deno.env.delete("MCP_INSECURE");
    if (origToken !== undefined) Deno.env.set("MCP_TOKEN", origToken);
    else Deno.env.delete("MCP_TOKEN");
  }
});

Deno.test("validateAuth denies when neither MCP_INSECURE nor MCP_TOKEN", async () => {
  const orig = Deno.env.get("MCP_INSECURE");
  const origToken = Deno.env.get("MCP_TOKEN");
  try {
    Deno.env.delete("MCP_INSECURE");
    Deno.env.delete("MCP_TOKEN");
    assertEquals(validateAuth(undefined), false);
    assertEquals(validateAuth("Bearer anything"), false);
  } finally {
    if (orig !== undefined) Deno.env.set("MCP_INSECURE", orig);
    else Deno.env.delete("MCP_INSECURE");
    if (origToken !== undefined) Deno.env.set("MCP_TOKEN", origToken);
    else Deno.env.delete("MCP_TOKEN");
  }
});
