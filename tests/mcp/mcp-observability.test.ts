/**
 * MCP observability: GET /health and giterloper_state_inspect expose mcpTestMode +
 * configuredKnowledgeStoreRemote with identical semantics (specs/MCP.md).
 */
import { assertEquals } from "jsr:@std/assert";
import { createMcpAppForTest } from "../../lib/gl-mcp-server.ts";
import { TEST_SOURCE } from "../helpers/config.ts";
import { MCP_INSECURE_TEST_AUTH } from "../helpers/mcp-test-auth.ts";

const MCP_URL = "http://localhost/mcp";
const MCP_ACCEPT = "application/json, text/event-stream";

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

Deno.test("MCP HTTP /health reports mcpTestMode and configuredKnowledgeStoreRemote in test mode", async () => {
  const app = await createMcpAppForTest({
    auth: MCP_INSECURE_TEST_AUTH,
    mcpTestMode: true,
    knowledgeStoreRemote: TEST_SOURCE,
  });
  const res = await app.request("http://localhost/health");
  assertEquals(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assertEquals(body.mcpTestMode, true);
  assertEquals(body.configuredKnowledgeStoreRemote, TEST_SOURCE);
});

Deno.test("MCP giterloper_state_inspect matches /health observability fields (shared core parity)", async () => {
  const app = await createMcpAppForTest({
    auth: MCP_INSECURE_TEST_AUTH,
    mcpTestMode: true,
    knowledgeStoreRemote: TEST_SOURCE,
  });

  const initRes = await app.request(
    new Request(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: MCP_ACCEPT,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "obs-test", version: "1.0.0" },
        },
      }),
    })
  );
  assertEquals(initRes.status, 200);
  const sessionId = initRes.headers.get("mcp-session-id");
  assertEquals(sessionId !== null && sessionId.length > 0, true);

  const healthRes = await app.request("http://localhost/health");
  const health = (await healthRes.json()) as Record<string, unknown>;

  const toolRes = await app.request(
    new Request(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: MCP_ACCEPT,
        "mcp-session-id": sessionId!,
        "mcp-protocol-version": "2024-11-05",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "giterloper_state_inspect",
          arguments: {},
        },
      }),
    })
  );
  assertEquals(toolRes.status, 200);
  const parsed = (await parseMcpResponse(toolRes)) as {
    result?: { content?: { text?: string }[] };
  };
  const text = parsed.result?.content?.[0]?.text;
  assertEquals(typeof text, "string");
  const inspect = JSON.parse(text!) as Record<string, unknown>;
  assertEquals(inspect.ok, true);
  assertEquals(inspect.mcpTestMode, health.mcpTestMode);
  assertEquals(
    inspect.configuredKnowledgeStoreRemote,
    health.configuredKnowledgeStoreRemote
  );
  assertEquals(inspect.mcpTestMode, true);
  assertEquals(inspect.configuredKnowledgeStoreRemote, TEST_SOURCE);
});
