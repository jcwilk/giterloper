/**
 * MCP-only giterloper_pin_set checks: tools/list schema, strict args, no client source.
 * Pin-law matrix lives in tests/pin-semantics/ (specs/pin-semantics.md).
 */
import { assertEquals } from "jsr:@std/assert";
import { createMcpAppForTest } from "../../lib/gl-mcp-server.ts";
import { TEST_SOURCE } from "../helpers/config.ts";
import { parseMcpResponse, parseToolResult, setupSession } from "../helpers/mcp-http-tool-session.ts";
import { withIsolatedGiterloperProjectRoot } from "../helpers/mcp-project-root-isolation.ts";
import { MCP_INSECURE_TEST_AUTH } from "../helpers/mcp-test-auth.ts";

const MCP_SCHEMA = "specs/mcp.md (transport, tools/list); specs/pin-semantics.md (pin inputs)";

/**
 * tools/list: giterloper_pin_set exposes branch and ref; no source on inputs.
 */
Deno.test("pin_set inputSchema includes branch and ref parameters", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
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
      `pin_set must have branch param (${MCP_SCHEMA}); got: ${JSON.stringify(props)}`
    );
    assertEquals(
      props.ref !== undefined && typeof (props.ref as { type?: string })?.type === "string",
      true,
      `pin_set must have ref param (${MCP_SCHEMA}); got: ${JSON.stringify(props)}`
    );
    assertEquals(
      props.source === undefined,
      true,
      `pin_set must not expose source on MCP inputs (${MCP_SCHEMA}); got: ${JSON.stringify(props)}`
    );
  });
});

/**
 * pin_set rejects unknown arguments (per git-8vrv: enforce argument validation).
 */
Deno.test("pin_set rejects unknown arguments", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
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
});

/** MCP must not accept client `source`; repo identity is server config only (specs/mcp.md, specs/pin-semantics.md). */
Deno.test("pin_set rejects source argument", async () => {
  await withIsolatedGiterloperProjectRoot(async () => {
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
        arguments: {
          source: "https://github.com/client/evil-repo.git",
          branch: "main",
        },
      },
    });
    assertEquals(res.status, 200);
    const result = (await parseToolResult(res)) as { ok?: boolean; code?: string; message?: string };
    assertEquals(result.ok, false, "pin_set must reject source (no client repo override on MCP)");
    const msg = (result.message ?? "").toLowerCase();
    assertEquals(
      msg.includes("unknown") ||
        msg.includes("unrecognized") ||
        msg.includes("additional") ||
        msg.includes("not allowed") ||
        msg.includes("invalid"),
      true,
      `Expected strict rejection of source; got: ${result.message ?? ""}`
    );
  });
});
