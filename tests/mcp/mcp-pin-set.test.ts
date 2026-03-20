/**
 * Unit tests for giterloper_pin_set.
 * Assert exact behavior per docs/PIN_SETTING_PARAM_BEHAVIOR.md.
 */
import { assertEquals } from "jsr:@std/assert";
import { randomBytes } from "node:crypto";
import { createMcpAppForTest } from "../../lib/gl-mcp-server.ts";
import { resolveShaOrRef } from "../../lib/git.ts";
import { TEST_SOURCE } from "../helpers/config.ts";
import { MCP_INSECURE_TEST_AUTH } from "../helpers/mcp-test-auth.ts";

const MCP_URL = "http://localhost/mcp";
const MCP_ACCEPT = "application/json, text/event-stream";
const PIN_SETTING_DOC = "docs/PIN_SETTING_PARAM_BEHAVIOR.md";

/** Collision-resistant names for shared-remote MCP tests under `deno test --parallel`. */
function mcpUnique(label: string): string {
  return `${label}_${randomBytes(8).toString("hex")}`;
}

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

async function setupSession(
  app: ReturnType<typeof createMcpAppForTest> extends Promise<infer T> ? T : never
): Promise<{ headers: Record<string, string>; req: (body: object, h?: Record<string, string>) => Promise<Response> }> {
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

/**
 * PIN_SETTING_PARAM_BEHAVIOR.md § Summary: inputSchema must include branch and ref.
 */
Deno.test("pin_set inputSchema includes branch and ref parameters", async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const listRes = await req(
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }
    );
    assertEquals(listRes.status, 200);
    const listBody = (await parseMcpResponse(listRes)) as {
      result?: { tools?: Array<{ name: string; inputSchema?: { properties?: Record<string, unknown> } }> };
    };
    const tools = listBody.result?.tools ?? [];
    const pinSet = tools.find((t) => t.name === "giterloper_pin_set");
    assertEquals(pinSet !== undefined, true, "giterloper_pin_set must be listed");
    const props = pinSet!.inputSchema?.properties ?? {};
    assertEquals(
      props.branch !== undefined && typeof (props.branch as { type?: string })?.type === "string",
      true,
      `pin_set must have branch param (${PIN_SETTING_DOC}); got: ${JSON.stringify(props)}`
    );
    assertEquals(
      props.ref !== undefined && typeof (props.ref as { type?: string })?.type === "string",
      true,
      `pin_set must have ref param (${PIN_SETTING_DOC}); got: ${JSON.stringify(props)}`
    );
});

/**
 * pin_set rejects unknown arguments (per git-8vrv: enforce argument validation).
 */
Deno.test("pin_set rejects unknown arguments", async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const res = await req({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "giterloper_pin_set",
        arguments: { branch: "main", unknownField: "x", pinName: "foo" },
      },
    });
    assertEquals(res.status, 200);
    const result = (await parseToolResult(res)) as { ok?: boolean; code?: string; message?: string };
    assertEquals(result.ok, false, "pin_set with unknown args must fail (schema .strict() or handler rejection)");
    const msg = result.message ?? "";
    assertEquals(
      msg.includes("Unknown arguments") ||
        msg.includes("unknownField") ||
        msg.includes("pinName") ||
        msg.toLowerCase().includes("unrecognized") ||
        msg.includes("additionalProperties"),
      true,
      `Expected rejection message for unknown args; got: ${msg.slice(0, 100)}`
    );
});

/** pin_set with pin _session is rejected; omit pin to target session pin. Per PIN_SETTING_PARAM_BEHAVIOR.md. */
Deno.test("pin_set with pin _session is rejected", async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const res = await req({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_pin_set", arguments: { pin: "_session", branch: "main" } },
    });
    assertEquals(res.status, 200);
    const result = (await parseToolResult(res)) as {
      ok?: boolean;
      code?: string;
      message?: string;
    };
    assertEquals(result.ok, false, "pin_set with pin _session must fail");
    assertEquals(result.code, "invalid_argument");
    assertEquals(
      (result.message ?? "").includes("reserved") || (result.message ?? "").includes("omit"),
      true
    );
});

/**
 * PIN_SETTING_PARAM_BEHAVIOR.md: No pin + no modifiers = view session pin. Named pin + no branch/ref = FAIL.
 */
Deno.test("pin_set with no branch and no ref fails", async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    // No pin, no branch, no sha — view session pin (succeeds when _session exists)
    const res1 = await req({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_pin_set", arguments: {} },
    });
    assertEquals(res1.status, 200);
    const result1 = (await parseToolResult(res1)) as {
      ok?: boolean;
      sessionPin?: { name: string; source: string; sha: string; branch: string | null };
    };
    assertEquals(result1.ok, true, "pin_set with no modifiers views session pin");
    assertEquals(result1.sessionPin?.name, "_session");

    // Pin name but no branch, no sha — operating on named pin with nothing to configure
    const res2 = await req({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "giterloper_pin_set", arguments: { pin: mcpUnique("noop") } },
    });
    assertEquals(res2.status, 200);
    const result2 = (await parseToolResult(res2)) as { ok?: boolean; code?: string };
    assertEquals(result2.ok, false, "pin_set with pin but no branch/ref must fail");
    assertEquals(result2.code, "invalid_argument");
});

/**
 * PIN_SETTING_PARAM_BEHAVIOR.md § Pin Storage: session pin's name is always _session.
 */
Deno.test("session pin name is _session after bootstrap", async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectRes = await req({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    });
    const inspectResult = (await parseToolResult(inspectRes)) as {
      pins?: Array<{ name: string }>;
    };
    assertEquals((inspectResult.pins?.length ?? 0) >= 1, true);
    const sessionRow = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(
      sessionRow !== undefined,
      true,
      `Session pin must be named _session (${PIN_SETTING_DOC})`
    );
});

/**
 * PIN_SETTING_PARAM_BEHAVIOR.md §1: Branch specified, ref not — use session pin SHA, update branch.
 */
Deno.test("pin_set branch-only (no pin) updates session pin branch, keeps SHA", async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectRes = await req({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    });
    assertEquals(inspectRes.status, 200);
    const inspectResult = (await parseToolResult(inspectRes)) as {
      ok?: boolean;
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    assertEquals(inspectResult.ok, true);
    assertEquals((inspectResult.pins?.length ?? 0) >= 1, true, "Need at least one pin");
    const sessionPin = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(sessionPin !== undefined, true, "Need _session pin");
    const originalSha = sessionPin!.sha;

    const branchName = mcpUnique("pin_set_branch_only");
    const setRes = await req({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "giterloper_pin_set", arguments: { branch: branchName } },
    });
    assertEquals(setRes.status, 200);
    const setResult = (await parseToolResult(setRes)) as {
      ok?: boolean;
      action?: string;
      sessionPin?: { name: string; source: string; sha: string; branch: string | null };
      message?: string;
    };
    assertEquals(setResult.ok, true);
    assertEquals(setResult.action, "pin_set");
    assertEquals(setResult.sessionPin?.name, "_session");
    assertEquals(setResult.sessionPin?.branch, branchName);
    assertEquals(setResult.sessionPin?.sha, originalSha, "SHA must remain unchanged");

    const inspect2Res = await req({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    });
    const inspect2 = (await parseToolResult(inspect2Res)) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const updated = inspect2.pins?.find((p) => p.name === "_session");
    assertEquals(updated?.branch, branchName);
    assertEquals(updated?.sha, originalSha);
});

/**
 * PIN_SETTING_PARAM_BEHAVIOR.md §1 + Pin Name: Branch + pin name — copy session SHA to named pin with branch.
 */
Deno.test("pin_set branch+pin creates named pin at session SHA, session pin unchanged", async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectRes = await req({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    });
    const inspectResult = (await parseToolResult(inspectRes)) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const sessionPin = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(sessionPin !== undefined, true);
    const sessionSha = sessionPin!.sha;
    const sessionBranch = sessionPin!.branch;

    const u = randomBytes(8).toString("hex");
    const snapshotName = `snapshot_test_${u}`;
    const snapshotBranch = `snapshot_branch_${u}`;

    const setRes = await req({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "giterloper_pin_set",
        arguments: { pin: snapshotName, branch: snapshotBranch },
      },
    });
    assertEquals(setRes.status, 200);
    const setResult = (await parseToolResult(setRes)) as {
      ok?: boolean;
      created?: boolean;
      pin?: { name: string; sha: string; branch: string | null };
    };
    assertEquals(setResult.ok, true);
    assertEquals(setResult.pin?.name, snapshotName);
    assertEquals(setResult.pin?.branch, snapshotBranch);
    assertEquals(setResult.created, true);

    const inspect2Res = await req({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    });
    const inspect2 = (await parseToolResult(inspect2Res)) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const sessionAfter = inspect2.pins?.find((p) => p.name === "_session");
    const snapshotPin = inspect2.pins?.find((p) => p.name === snapshotName);
    assertEquals(sessionAfter !== undefined, true);
    assertEquals(snapshotPin !== undefined, true);
    assertEquals(
      snapshotPin!.sha,
      sessionAfter!.sha,
      "Named pin must inherit session pin SHA (single inspect after pin_set)"
    );
    assertEquals(setResult.pin?.sha, snapshotPin!.sha, "Tool output matches pinned.yaml");
    assertEquals(sessionAfter?.sha, sessionSha, "Session pin SHA unchanged");
    assertEquals(sessionAfter?.branch, sessionBranch, "Session pin branch unchanged");
    assertEquals(snapshotPin?.branch, snapshotBranch);
});

/**
 * PIN_SETTING_PARAM_BEHAVIOR.md §2: ref specified, branch not — set pin branchlessly (read-only).
 */
Deno.test("pin_set ref-only sets pin branchlessly", async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectRes = await req({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    });
    const inspectResult = (await parseToolResult(inspectRes)) as {
      pins?: Array<{ name: string; source: string; sha: string }>;
    };
    const sessionPin = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(sessionPin !== undefined, true);
    const sha = sessionPin!.sha;
    const branchlessName = mcpUnique("branchless");

    const setRes = await req({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "giterloper_pin_set",
        arguments: { pin: branchlessName, ref: sha },
      },
    });
    assertEquals(setRes.status, 200);
    const setResult = (await parseToolResult(setRes)) as {
      ok?: boolean;
      pin?: { name: string; sha: string; branch: string | null };
    };
    assertEquals(setResult.ok, true);
    assertEquals(setResult.pin?.name, branchlessName);
    assertEquals(setResult.pin?.sha, sha);
    assertEquals(setResult.pin?.branch, null, "Must be branchless (read-only)");

    const inspect2Res = await req({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    });
    const inspect2 = (await parseToolResult(inspect2Res)) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const branchlessPin = inspect2.pins?.find((p) => p.name === branchlessName);
    assertEquals(branchlessPin?.sha, sha);
    assertEquals(branchlessPin?.branch, null);
});

/**
 * PIN_SETTING_PARAM_BEHAVIOR.md §2: ref may be a branch name; we resolve it to SHA from remote.
 */
Deno.test("pin_set ref as branch name resolves to SHA", async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectRes = await req({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    });
    const inspectResult = (await parseToolResult(inspectRes)) as {
      pins?: Array<{ name: string; source: string; sha: string }>;
    };
    const sessionPin = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(sessionPin !== undefined, true);
    const branchlessName = mcpUnique("ref_main");

    const setRes = await req({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "giterloper_pin_set",
        arguments: { pin: branchlessName, ref: "main" },
      },
    });
    assertEquals(setRes.status, 200);
    const setResult = (await parseToolResult(setRes)) as {
      ok?: boolean;
      pin?: { name: string; sha: string; branch: string | null };
    };
    assertEquals(setResult.ok, true);
    assertEquals(setResult.pin?.name, branchlessName);
    assertEquals(setResult.pin?.branch, null);
    // Resolve main immediately after pin_set so parallel pushes to main cannot stale the expected SHA.
    const mainSha = await resolveShaOrRef(sessionPin!.source, "main");
    assertEquals(
      setResult.pin?.sha,
      mainSha,
      "ref=main must resolve to main's HEAD SHA from remote"
    );

    const inspect2Res = await req({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    });
    const inspect2 = (await parseToolResult(inspect2Res)) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const pin = inspect2.pins?.find((p) => p.name === branchlessName);
    assertEquals(pin?.sha, mainSha);
    assertEquals(pin?.branch, null);
});

/**
 * PIN_SETTING_PARAM_BEHAVIOR.md §3: Both ref and branch — use resolved ref SHA, not session SHA.
 */
Deno.test("pin_set ref+branch+pin uses ref SHA not session SHA", async () => {
    const app = await createMcpAppForTest({
      auth: MCP_INSECURE_TEST_AUTH,
      knowledgeStoreRemote: TEST_SOURCE,
    });
    const { req } = await setupSession(app);

    const inspectRes = await req({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    });
    const inspectResult = (await parseToolResult(inspectRes)) as {
      pins?: Array<{ name: string; source: string; sha: string }>;
    };
    const sessionPin = inspectResult.pins!.find((p) => p.name === "_session");
    assertEquals(sessionPin !== undefined, true);
    const u = randomBytes(8).toString("hex");
    const snapshotName = `ref_branch_pin_${u}`;
    const snapshotBranch = `ref_branch_${u}`;

    const setRes = await req({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "giterloper_pin_set",
        arguments: { pin: snapshotName, ref: "main", branch: snapshotBranch },
      },
    });
    assertEquals(setRes.status, 200);
    const setResult = (await parseToolResult(setRes)) as {
      ok?: boolean;
      pin?: { name: string; sha: string; branch: string | null };
    };
    assertEquals(setResult.ok, true);
    const mainSha = await resolveShaOrRef(sessionPin!.source, "main");
    assertEquals(
      setResult.pin?.sha,
      mainSha,
      "ref=main must resolve to main HEAD SHA, not session SHA"
    );
    assertEquals(setResult.pin?.branch, snapshotBranch);

    const inspect2Res = await req({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "giterloper_state_inspect", arguments: {} },
    });
    const inspect2 = (await parseToolResult(inspect2Res)) as {
      pins?: Array<{ name: string; sha: string; branch: string | null }>;
    };
    const pin = inspect2.pins?.find((p) => p.name === snapshotName);
    assertEquals(pin?.sha, mainSha);
    assertEquals(pin?.branch, snapshotBranch);
});
