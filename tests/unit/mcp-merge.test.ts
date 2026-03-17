/**
 * Unit tests for giterloper_merge.
 * Assert pin-name behavior per docs/PIN_SETTING_PARAM_BEHAVIOR.md § Merge Tool Exception.
 */
import { assertEquals } from "jsr:@std/assert";
import { createMcpAppForTest } from "../../lib/gl-mcp-server.ts";
import { TEST_SOURCE } from "../e2e/config.ts";

const MCP_URL = "http://localhost/mcp";
const MCP_ACCEPT = "application/json, text/event-stream";
const PIN_SETTING_DOC = "docs/PIN_SETTING_PARAM_BEHAVIOR.md";

async function mcpRequest(
  body: object,
  headers: Record<string, string>,
  app: { request: (req: Request) => Response | Promise<Response> }
): Promise<Response> {
  return app.request(
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
}

async function parseMcpResponse(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (ct.includes("application/json")) return JSON.parse(text);
  if (ct.includes("text/event-stream")) {
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    if (dataLine) return JSON.parse(dataLine.slice(6));
  }
  throw new Error(`Cannot parse MCP response: ${text.slice(0, 200)}`);
}

async function parseToolResult(res: Response): Promise<unknown> {
  const body = (await parseMcpResponse(res)) as {
    result?: { content?: Array<{ text?: string }> };
  };
  const text = body.result?.content?.[0]?.text;
  if (typeof text !== "string") return null;
  return JSON.parse(text);
}

/**
 * PIN_SETTING_PARAM_BEHAVIOR.md § Merge Tool Exception: Both omitted → merge into itself → FAIL.
 */
Deno.test("merge with both sourcePin and targetPin omitted fails", async () => {
  const orig = Deno.env.get("MCP_INSECURE");
  try {
    Deno.env.set("MCP_INSECURE", "true");
    const app = await createMcpAppForTest();
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

    const res = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "giterloper_merge",
          arguments: {},
        },
      },
      headers,
      app
    );
    assertEquals(res.status, 200);
    const result = (await parseToolResult(res)) as { ok?: boolean; code?: string; message?: string };
    assertEquals(result.ok, false, "merge with both omitted must fail");
    assertEquals(result.code, "invalid_argument");
    assertEquals(
      (result.message ?? "").toLowerCase().includes("merge") &&
        ((result.message ?? "").toLowerCase().includes("itself") ||
          (result.message ?? "").toLowerCase().includes("same")),
      true,
      `Expected "cannot merge a pin into itself" or similar (${PIN_SETTING_DOC})`
    );
  } finally {
    if (orig !== undefined) Deno.env.set("MCP_INSECURE", orig);
    else Deno.env.delete("MCP_INSECURE");
  }
});

/**
 * PIN_SETTING_PARAM_BEHAVIOR.md § Merge Tool Exception: Both same pin name → merge into itself → FAIL.
 * Use a named pin (not _session) since _session is rejected before the merge handler.
 */
Deno.test("merge with same sourcePin and targetPin fails", async () => {
  const origInsecure = Deno.env.get("MCP_INSECURE");
  const origRemote = Deno.env.get("KNOWLEDGE_STORE_REMOTE");
  try {
    Deno.env.set("MCP_INSECURE", "true");
    Deno.env.set("KNOWLEDGE_STORE_REMOTE", TEST_SOURCE);
    const app = await createMcpAppForTest();
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
    const headers = { "mcp-session-id": sessionId!, "mcp-protocol-version": "2024-11-05" };

    const mergeTestBranch = `merge_same_${Date.now()}`;
    const mergeTestPin = `merge_same_pin_${Date.now()}`;
    await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "giterloper_pin_set",
          arguments: { pin: mergeTestPin, branch: mergeTestBranch },
        },
      },
      headers,
      app
    );

    const res = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "giterloper_merge",
          arguments: { sourcePin: mergeTestPin, targetPin: mergeTestPin },
        },
      },
      headers,
      app
    );
    assertEquals(res.status, 200);
    const result = (await parseToolResult(res)) as { ok?: boolean; code?: string; message?: string };
    assertEquals(result.ok, false, "merge with same source and target must fail");
    assertEquals(result.code, "invalid_argument");
    assertEquals(
      (result.message ?? "").toLowerCase().includes("itself") ||
        (result.message ?? "").toLowerCase().includes("same"),
      true,
      `Expected "cannot merge a pin into itself" or similar (${PIN_SETTING_DOC})`
    );
  } finally {
    if (origInsecure !== undefined) Deno.env.set("MCP_INSECURE", origInsecure);
    else Deno.env.delete("MCP_INSECURE");
    if (origRemote !== undefined) Deno.env.set("KNOWLEDGE_STORE_REMOTE", origRemote);
    else Deno.env.delete("KNOWLEDGE_STORE_REMOTE");
  }
});
