/**
 * Shared HTTP MCP session helpers for integration tests that call tools/call and tools/list.
 */
import { assertEquals } from "jsr:@std/assert";
import { randomBytes } from "node:crypto";
import { createMcpAppForTest } from "../../lib/gl-mcp-server.ts";

export const MCP_URL = "http://localhost/mcp";
export const MCP_ACCEPT = "application/json, text/event-stream";

export type McpTestApp = Awaited<ReturnType<typeof createMcpAppForTest>>;

/** Collision-resistant names for shared-remote MCP tests under `deno test --parallel`. */
export function mcpUnique(label: string): string {
  return `${label}_${randomBytes(8).toString("hex")}`;
}

export async function mcpRequest(
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

export async function parseMcpResponse(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (ct.includes("application/json")) return JSON.parse(text);
  if (ct.includes("text/event-stream")) {
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    if (dataLine) return JSON.parse(dataLine.slice(6));
  }
  throw new Error(`Cannot parse MCP response: ${text.slice(0, 200)}`);
}

export async function parseToolResult(res: Response): Promise<unknown> {
  const body = (await parseMcpResponse(res)) as {
    result?: { content?: Array<{ text?: string }>; isError?: boolean };
    error?: { code?: number; message?: string };
  };
  if (body.error) return { ok: false, code: "invalid_argument", message: body.error.message };
  const text = body.result?.content?.[0]?.text;
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, message: text };
  }
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** `tools/call` with minimal transport retries (5xx); tool/json errors rely on lib retries. */
export async function reqTool(
  req: (body: object) => Promise<Response>,
  callBody: object,
  maxAttempts = 2
): Promise<unknown> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await req(callBody);
    if (res.status >= 500 && res.status < 600 && attempt < maxAttempts - 1) {
      await sleepMs(1500 * (attempt + 1));
      continue;
    }
    if (res.status !== 200) {
      const t = await res.text();
      throw new Error(`MCP tools/call HTTP ${res.status}: ${t.slice(0, 300)}`);
    }
    return parseToolResult(res);
  }
  throw new Error("reqTool: unreachable");
}

export async function setupSession(app: McpTestApp): Promise<{
  headers: Record<string, string>;
  req: (body: object, h?: Record<string, string>) => Promise<Response>;
}> {
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
  const req = (body: object, h: Record<string, string> = {}) =>
    mcpRequest(body, { ...headers, ...h }, app);
  return { headers, req };
}
