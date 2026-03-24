/**
 * Merge tool pin-law (pin-semantics slice — Merge tool exception), via MCP HTTP.
 */
import { assertEquals } from "jsr:@std/assert";
import { randomBytes } from "node:crypto";
import { createMcpAppForTest } from "../../lib/gl-mcp-server.ts";
import { TEST_SOURCE } from "../helpers/config.ts";
import { mcpRequest, parseToolResult } from "../helpers/mcp-http-tool-session.ts";
import { MCP_INSECURE_TEST_AUTH } from "../helpers/mcp-test-auth.ts";

const PIN_LAW_HINT = "pin-semantics slice — tests/README pairing";

/** Merge tool exception: both pins omitted → same session → FAIL. */
Deno.test("merge with both sourcePin and targetPin omitted fails", async () => {
  const app = await createMcpAppForTest({
    auth: MCP_INSECURE_TEST_AUTH,
    knowledgeStoreRemote: null,
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
    `Expected cannot-merge-into-itself style message (${PIN_LAW_HINT} — Merge tool exception)`
  );
});

/**
 * Merge tool exception: same explicit pin name for source and target → FAIL.
 * Uses a named pin (not _session) since _session is rejected before the merge handler.
 */
Deno.test("merge with same sourcePin and targetPin fails", async () => {
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
  const headers = { "mcp-session-id": sessionId!, "mcp-protocol-version": "2024-11-05" };

  const u = randomBytes(8).toString("hex");
  const mergeTestBranch = `merge_same_${u}`;
  const mergeTestPin = `merge_same_pin_${u}`;
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
    `Expected cannot-merge-into-itself style message (${PIN_LAW_HINT} — Merge tool exception)`
  );
});
