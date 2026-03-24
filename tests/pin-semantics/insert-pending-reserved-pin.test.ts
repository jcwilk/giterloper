/**
 * insert_pending pin name rules (specs/pin-semantics.md — Pin name; same as other MCP tools).
 * Invoked via MCP HTTP; content validation helpers stay in tests/mcp/mcp-insert-pending.test.ts.
 */
import { assertEquals } from "jsr:@std/assert";
import { createMcpAppForTest } from "../../lib/gl-mcp-server.ts";
import { mcpRequest, parseToolResult } from "../helpers/mcp-http-tool-session.ts";
import { withIsolatedGiterloperProjectRoot } from "../helpers/mcp-project-root-isolation.ts";
import { MCP_INSECURE_TEST_AUTH } from "../helpers/mcp-test-auth.ts";

const PIN_LAW = "specs/pin-semantics.md";

/** Explicit pin "_session" must fail; omit pin for session pin. */
Deno.test("insert_pending with pin _session is rejected", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: "github.com/jcwilk/giterloper_test_knowledge",
    });
    const initRes = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
      },
      {},
      app
    );
    assertEquals(initRes.status, 200);
    const sessionId = initRes.headers.get("mcp-session-id");
    assertEquals(sessionId !== null && sessionId.length > 0, true);
    const headers = { "mcp-session-id": sessionId!, "mcp-protocol-version": "2024-11-05" };

    const insertRes = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "giterloper_insert_pending",
          arguments: { pin: "_session", content: "# Test\n\ncontent" },
        },
      },
      headers,
      app
    );
    assertEquals(insertRes.status, 200);
    const result = (await parseToolResult(insertRes)) as { ok?: boolean; code?: string; message?: string };
    assertEquals(result.ok, false, "insert_pending with pin _session must fail");
    assertEquals(result.code, "invalid_argument");
    assertEquals(
      (result.message ?? "").toLowerCase().includes("reserved") ||
        (result.message ?? "").toLowerCase().includes("omit"),
      true,
      `Must include corrective guidance (${PIN_LAW} — Pin name)`
    );
  });
});
