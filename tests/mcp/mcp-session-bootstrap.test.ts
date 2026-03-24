/**
 * MCP session pin bootstrap: `_session` exists at effective knowledge remote before first tool
 * (specs/mcp.md — Session pin bootstrap). HTTP: after initialize; stdio: eager hook after connect.
 */
import { assert, assertEquals } from "jsr:@std/assert";
import { join } from "node:path";
import {
  createMcpAppForTest,
  createServer,
} from "../../lib/gl-mcp-server.ts";
import { effectiveGiterloperSessionsRoot } from "../../lib/session-layout.ts";
import { TEST_SOURCE } from "../helpers/config.ts";
import { withIsolatedGiterloperProjectRoot } from "../helpers/mcp-project-root-isolation.ts";
import { MCP_INSECURE_TEST_AUTH } from "../helpers/mcp-test-auth.ts";

const MCP_URL = "http://localhost/mcp";
const MCP_ACCEPT = "application/json, text/event-stream";

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

Deno.test(
  "MCP HTTP: after initialize, pinned.yaml lists _session before any tool call",
  async () => {
    await withIsolatedGiterloperProjectRoot(async () => {
      const projectRoot = Deno.env.get("GITERLOPER_PROJECT_ROOT")!;
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
              clientInfo: { name: "bootstrap-test", version: "1.0.0" },
            },
          }),
        })
      );
      assertEquals(initRes.status, 200);
      const sessionId = initRes.headers.get("mcp-session-id");
      assert(sessionId !== null && sessionId.length > 0);

      const pinnedPath = join(
        effectiveGiterloperSessionsRoot(projectRoot, true),
        sessionId,
        "pinned.yaml",
      );
      const yaml = Deno.readTextFileSync(pinnedPath);
      assert(
        yaml.includes("_session:"),
        "pinned.yaml must contain _session after initialize"
      );

      const inspectRes = await app.request(
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
      assertEquals(inspectRes.status, 200);
      const parsed = (await parseMcpResponse(inspectRes)) as {
        result?: { content?: { text?: string }[] };
      };
      const inspect = JSON.parse(parsed.result?.content?.[0]?.text ?? "{}") as {
        ok?: boolean;
        pins?: { name: string }[];
      };
      assertEquals(inspect.ok, true);
      assert(
        inspect.pins?.some((p) => p.name === "_session"),
        "first state_inspect must list _session (no empty-pin missing_pin)"
      );
    });
  }
);

Deno.test(
  "MCP stdio parity: eagerBootstrapStdioSession creates _session before tools",
  async () => {
    await withIsolatedGiterloperProjectRoot(async () => {
      const projectRoot = Deno.env.get("GITERLOPER_PROJECT_ROOT")!;
      const sessionId = "stdio-bootstrap-test-session";
      const { eagerBootstrapStdioSession } = createServer({
        mcpTestMode: true,
        knowledgeStoreRemote: TEST_SOURCE,
        getSessionId: () => sessionId,
      });
      eagerBootstrapStdioSession();

      const pinnedPath = join(
        effectiveGiterloperSessionsRoot(projectRoot, true),
        sessionId,
        "pinned.yaml",
      );
      const yaml = Deno.readTextFileSync(pinnedPath);
      assert(
        yaml.includes("_session:"),
        "pinned.yaml must contain _session after eager stdio bootstrap"
      );
    });
  }
);
