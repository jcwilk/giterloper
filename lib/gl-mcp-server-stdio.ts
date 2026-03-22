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

const stdioSessionId = randomUUID();
const server = createServer({
  getSessionId: () => stdioSessionId,
});
const transport = new StdioServerTransport();
await server.connect(transport);

const ttlMs = getSessionTtlMs();
if (ttlMs > 0) {
  const intervalMs = Math.min(ttlMs / 4, 15 * 60 * 1000);
  setInterval(() => scavengeStaleSessions(ttlMs), intervalMs);
}

console.error("Giterloper MCP server (stdio) running; sessionId=", stdioSessionId);
