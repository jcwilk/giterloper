/**
 * Tests for MCP protocol session lifecycle: initialize returns session header,
 * tool calls without valid session fail with actionable guidance, session reuse by header.
 * See ticket git-9bqz.
 */
import { assertEquals } from "jsr:@std/assert";
import { mcpApp } from "../../lib/gl-mcp-server.ts";

const MCP_URL = "http://localhost/mcp";
const MCP_ACCEPT = "application/json, text/event-stream";

async function mcpRequest(
  body: object,
  headers: Record<string, string> = {}
): Promise<Response> {
  const res = await mcpApp.request(
    new Request(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: MCP_ACCEPT,
        ...headers,
      },
      body: JSON.stringify(body),
    })
  );
  return res;
}

/** Runs first: initialize returns mcp-session-id; then reuse session for tool call. */
Deno.test(
  "MCP session lifecycle: initialize returns mcp-session-id header and session reuse succeeds",
  async () => {
    const orig = Deno.env.get("MCP_INSECURE");
    try {
      Deno.env.set("MCP_INSECURE", "true");
      const initRes = await mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
      });
      assertEquals(initRes.status, 200);
      const sessionId = initRes.headers.get("mcp-session-id");
      assertEquals(sessionId !== null && sessionId.length > 0, true);

      // Session reuse: tool call with mcp-session-id header succeeds
      const toolRes = await mcpRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        },
        { "mcp-session-id": sessionId!, "mcp-protocol-version": "2024-11-05" }
      );
      assertEquals(toolRes.status, 200);
    } finally {
      if (orig !== undefined) Deno.env.set("MCP_INSECURE", orig);
      else Deno.env.delete("MCP_INSECURE");
    }
  }
);

Deno.test(
  "MCP session lifecycle: tool call without session fails with actionable guidance",
  async () => {
    const orig = Deno.env.get("MCP_INSECURE");
    try {
      Deno.env.set("MCP_INSECURE", "true");
      // Tool call WITHOUT mcp-session-id header - should fail with 400
      const res = await mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      });
      assertEquals(res.status, 400);
      const body = await res.json();
      const msg = (body.error?.message ?? "").toLowerCase();
      assertEquals(
        msg.includes("mcp-session-id") || msg.includes("not initialized"),
        true,
        `Expected actionable guidance, got: ${body.error?.message}`
      );
    } finally {
      if (orig !== undefined) Deno.env.set("MCP_INSECURE", orig);
      else Deno.env.delete("MCP_INSECURE");
    }
  }
);
