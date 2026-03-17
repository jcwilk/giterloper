/**
 * Unit tests for giterloper_pin_set branch-only path.
 * See ticket git-7n1b: when called with only a branch (no pin name),
 * updates the default pin's branch, keeping its SHA.
 */
import { assertEquals } from "jsr:@std/assert";
import { createMcpAppForTest } from "../../lib/gl-mcp-server.ts";

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

/** Parse MCP response; handles both JSON and SSE. */
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

Deno.test("pin_set branch-only updates default pin branch, keeps SHA", async () => {
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
    const headers = { "mcp-session-id": sessionId!, "mcp-protocol-version": "2024-11-05" };

    // View current default first (requires bootstrap from shared pinned.yaml)
    const viewRes = await req(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "giterloper_pin_set", arguments: {} },
      },
      headers
    );
    assertEquals(viewRes.status, 200);
    const viewResult = (await parseToolResult(viewRes)) as {
      ok?: boolean;
      defaultPin?: string;
      message?: string;
    };
    if (!viewResult?.ok || !viewResult.defaultPin) {
      throw new Error(
        `Need at least one pin for test. View result: ${JSON.stringify(viewResult)}`
      );
    }
    const defaultPinName = viewResult.defaultPin;

    // Get current SHA via state_inspect
    const inspectRes = await req(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "giterloper_state_inspect", arguments: {} },
      },
      headers
    );
    assertEquals(inspectRes.status, 200);
    const inspectResult = (await parseToolResult(inspectRes)) as {
      ok?: boolean;
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const defaultPinInfo = inspectResult.pins?.find((p) => p.name === defaultPinName);
    assertEquals(defaultPinInfo !== undefined, true);
    const originalSha = defaultPinInfo!.sha;

    // Branch-only: update default pin's branch
    const branchName = `pin_set_branch_only_${Date.now()}`;
    const setRes = await req(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "giterloper_pin_set", arguments: { branch: branchName } },
      },
      headers
    );
    assertEquals(setRes.status, 200);
    const setResult = (await parseToolResult(setRes)) as {
      ok?: boolean;
      action?: string;
      pin?: { name: string; source: string; sha: string; branch: string | null };
      message?: string;
    };
    assertEquals(setResult.ok, true);
    assertEquals(setResult.action, "pin_set");
    assertEquals(setResult.pin?.name, defaultPinName);
    assertEquals(setResult.pin?.branch, branchName);
    assertEquals(setResult.pin?.sha, originalSha, "SHA must remain unchanged");
    assertEquals(setResult.message, "Updated default pin branch");

    // Verify persistence: view again should show the new branch
    const view2Res = await req(
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "giterloper_state_inspect", arguments: {} },
      },
      headers
    );
    assertEquals(view2Res.status, 200);
    const view2Result = (await parseToolResult(view2Res)) as {
      pins?: Array<{ name: string; branch: string | null }>;
    };
    const updatedPin = view2Result.pins?.find((p) => p.name === defaultPinName);
    assertEquals(updatedPin?.branch, branchName);
  } finally {
    if (orig !== undefined) Deno.env.set("MCP_INSECURE", orig);
    else Deno.env.delete("MCP_INSECURE");
  }
});
