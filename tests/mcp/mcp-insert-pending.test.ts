import { assertEquals } from "jsr:@std/assert";
import { randomBytes } from "node:crypto";
import { createMcpAppForTest, validateInsertContent } from "../../lib/gl-mcp-server.ts";
import { TEST_SOURCE } from "../helpers/config.ts";
import { withIsolatedGiterloperProjectRoot } from "../helpers/mcp-project-root-isolation.ts";
import { MCP_INSECURE_TEST_AUTH } from "../helpers/mcp-test-auth.ts";

const MCP_URL = "http://localhost/mcp";
const MCP_ACCEPT = "application/json, text/event-stream";

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

async function parseToolResult(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  const body = ct.includes("application/json")
    ? JSON.parse(text)
    : (() => {
        const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
        return dataLine ? JSON.parse(dataLine.slice(6)) : { result: {} };
      })();
  const content = body.result?.content?.[0]?.text;
  if (typeof content !== "string") return null;
  try {
    return JSON.parse(content);
  } catch {
    return { ok: false, message: content };
  }
}

/** insert_pending with omitted pin uses session pin and advances SHA. Per spec: omit pin targets session pin; updatePinSha no longer rejects _session on internal lifecycle path. */
Deno.test("insert_pending with content only uses session pin", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
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

    const branchName = `insert_pin_omit_${randomBytes(8).toString("hex")}`;
    await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "giterloper_pin_set", arguments: { branch: branchName } },
      },
      headers,
      app
    );

    const insertRes = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "giterloper_insert_pending",
          arguments: { content: "# Insert Omit Pin Test\n\nmarker_insert_omit" },
        },
      },
      headers,
      app
    );
    assertEquals(insertRes.status, 200);
    const result = (await parseToolResult(insertRes)) as { ok?: boolean; action?: string };
    assertEquals(result.ok, true, `insert_pending with omitted pin should succeed, got: ${JSON.stringify(result)}`);
    assertEquals(result.action, "inserted");
  });
});

Deno.test("validateInsertContent rejects empty string", () => {
  const result = validateInsertContent("");
  assertEquals(result, {
    ok: false,
    code: "invalid_argument",
    message: "content must be non-empty",
    details: {},
  });
});

Deno.test("validateInsertContent rejects whitespace-only", () => {
  const result = validateInsertContent("   \n\t  ");
  assertEquals(result, {
    ok: false,
    code: "invalid_argument",
    message: "content must be non-empty",
    details: {},
  });
});

Deno.test("validateInsertContent rejects null", () => {
  const result = validateInsertContent(null);
  assertEquals(result, {
    ok: false,
    code: "invalid_argument",
    message: "content must be non-empty",
    details: {},
  });
});

/** insert_pending with explicit pin "_session" must fail. Per specs/core.md (Pin configuration semantics). */
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
      "Must include corrective guidance"
    );
  });
});

Deno.test("validateInsertContent rejects undefined", () => {
  const result = validateInsertContent(undefined);
  assertEquals(result, {
    ok: false,
    code: "invalid_argument",
    message: "content must be non-empty",
    details: {},
  });
});

Deno.test("validateInsertContent accepts non-empty content", () => {
  assertEquals(validateInsertContent("# Hello"), null);
  assertEquals(validateInsertContent("  # trimmed  "), null);
  assertEquals(validateInsertContent("x"), null);
});
