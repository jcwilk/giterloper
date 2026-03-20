import type { McpAuthRuntime } from "../../lib/mcp-auth.ts";

/** In-process MCP HTTP tests: no Bearer token; skip auth middleware checks. */
export const MCP_INSECURE_TEST_AUTH: McpAuthRuntime = {
  insecure: true,
  expectedToken: null,
};
