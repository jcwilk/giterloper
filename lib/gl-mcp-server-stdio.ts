#!/usr/bin/env -S deno run -A
/**
 * Giterloper MCP server over stdio. One process-scoped session; same tool/session
 * semantics as HTTP. Logging goes to stderr so stdout stays clean for JSON-RPC.
 * See docs/STDIO_TRANSPORT_SPIKE.md and specs/MCP.md.
 */
import { randomUUID } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { consumeBooleanFlag } from "./cli.ts";
import { createServer } from "./gl-mcp-server.ts";
import { getSessionTtlMs, scavengeStaleSessions } from "./mcp-session-store.ts";

const stdioSessionId = randomUUID();
let argv = [...Deno.args];
const mcpTestFlag = consumeBooleanFlag(argv, "--mcp-test-mode");
argv = mcpTestFlag.args;
if (argv.length > 0) {
  console.error(
    `giterloper MCP (stdio): unexpected argument(s): ${argv.map((a) => JSON.stringify(a)).join(" ")}`
  );
  Deno.exit(1);
}
const stdioMcpTestMode = mcpTestFlag.found;
const { server, eagerBootstrapStdioSession } = createServer({
  getSessionId: () => stdioSessionId,
  mcpTestMode: stdioMcpTestMode,
});
const transport = new StdioServerTransport();
await server.connect(transport);
eagerBootstrapStdioSession();

const ttlMs = getSessionTtlMs();
if (ttlMs > 0) {
  const intervalMs = Math.min(ttlMs / 4, 15 * 60 * 1000);
  setInterval(() => scavengeStaleSessions(ttlMs, stdioMcpTestMode), intervalMs);
}

console.error("Giterloper MCP server (stdio) running; sessionId=", stdioSessionId);
