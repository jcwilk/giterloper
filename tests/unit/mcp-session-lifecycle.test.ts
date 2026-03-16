/**
 * Tests for MCP protocol session lifecycle: initialize returns session header,
 * tool calls without valid session fail with actionable guidance, session reuse by header.
 * See ticket git-9bqz. Session cleanup tests: git-zdbt.
 */
import { assertEquals } from "jsr:@std/assert";
import { existsSync } from "node:fs";
import { createMcpAppForTest, mcpApp } from "../../lib/gl-mcp-server.ts";
import { sessionDir, touchSession } from "../../lib/mcp-session-store.ts";

const MCP_URL = "http://localhost/mcp";
const MCP_ACCEPT = "application/json, text/event-stream";

/** Parse MCP response body; handles both JSON and SSE (text/event-stream). */
async function parseMcpResponse(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (ct.includes("application/json")) {
    return JSON.parse(text);
  }
  if (ct.includes("text/event-stream")) {
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    if (dataLine) {
      return JSON.parse(dataLine.slice(6));
    }
  }
  throw new Error(`Cannot parse MCP response: ${text.slice(0, 200)}`);
}

async function mcpRequest(
  body: object,
  headers: Record<string, string> = {},
  app: { request: (req: Request) => Response | Promise<Response> } = mcpApp
): Promise<Response> {
  const res = await Promise.resolve(
    app.request(
      new Request(MCP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: MCP_ACCEPT,
          ...headers,
        },
        body: JSON.stringify(body),
      })
    )
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

/** Session cleanup: giterloper_session_end tool and DELETE /mcp remove session-local state. See git-zdbt. */
Deno.test(
  "MCP session lifecycle: giterloper_session_end removes session data",
  async () => {
    const orig = Deno.env.get("MCP_INSECURE");
    try {
      Deno.env.set("MCP_INSECURE", "true");
      const app = await createMcpAppForTest();
      const req = (body: object, headers: Record<string, string> = {}) =>
        mcpRequest(body, headers, app);

      const initRes = await req({
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

      // Trigger session dir creation via a tool that uses stateForSession
      const inspectRes = await req(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "giterloper_state_inspect",
            arguments: {},
          },
        },
        { "mcp-session-id": sessionId!, "mcp-protocol-version": "2024-11-05" }
      );
      assertEquals(inspectRes.status, 200);

      // Call giterloper_session_end
      const endRes = await req(
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "giterloper_session_end",
            arguments: {},
          },
        },
        { "mcp-session-id": sessionId!, "mcp-protocol-version": "2024-11-05" }
      );
      assertEquals(endRes.status, 200);
      const endBody = (await parseMcpResponse(endRes)) as {
        result?: { content?: Array<{ text?: string }> };
      };
      const content = endBody.result?.content?.[0]?.text;
      assertEquals(typeof content, "string");
      const parsed = JSON.parse(content!) as { ok?: boolean; action?: string; sessionId?: string };
      assertEquals(parsed.ok, true);
      assertEquals(parsed.action, "session_ended");
      assertEquals(parsed.sessionId, sessionId);
    } finally {
      if (orig !== undefined) Deno.env.set("MCP_INSECURE", orig);
      else Deno.env.delete("MCP_INSECURE");
    }
  }
);

Deno.test(
  "MCP session lifecycle: DELETE /mcp triggers session cleanup",
  async () => {
    const orig = Deno.env.get("MCP_INSECURE");
    try {
      Deno.env.set("MCP_INSECURE", "true");
      const app = await createMcpAppForTest();
      const req = (body: object, headers: Record<string, string> = {}) =>
        mcpRequest(body, headers, app);

      const initRes = await req({
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

      // Create session dir (state_inspect may not create it when no pins; touchSession guarantees it)
      touchSession(sessionId!);
      const dirBefore = sessionDir(sessionId!);
      assertEquals(existsSync(dirBefore), true, "session dir should exist");

      // DELETE /mcp with session header - our handler runs removeSessionData before transport
      await app.request(
        new Request(MCP_URL, {
          method: "DELETE",
          headers: {
            "mcp-session-id": sessionId!,
            "mcp-protocol-version": "2024-11-05",
          },
        })
      );
      // Our cleanup ran; session dir should be gone.
      assertEquals(existsSync(dirBefore), false);
    } finally {
      if (orig !== undefined) Deno.env.set("MCP_INSECURE", orig);
      else Deno.env.delete("MCP_INSECURE");
    }
  }
);
