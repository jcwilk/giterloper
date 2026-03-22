#!/usr/bin/env -S deno run -A
/**
 * Giterloper MCP server over stdio. One process-scoped session; same tool/session
 * semantics as HTTP. Logging goes to stderr so stdout stays clean for JSON-RPC.
 * See docs/STDIO_TRANSPORT_SPIKE.md and specs/MCP.md.
 */
import { randomUUID } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./gl-mcp-server.ts";
import { getSessionTtlMs, scavengeStaleSessions } from "./mcp-session-store.ts";
import { resolveMcpTestMode } from "./session-layout.ts";

const stdioSessionId = randomUUID();
const stdioMcpTestMode = resolveMcpTestMode();
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
