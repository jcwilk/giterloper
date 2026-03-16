# Stdio transport compatibility spike (git-odv6)

Short spike to confirm `StdioServerTransport` behavior under Deno + MCP SDK 1.27.

## Findings

- **Constructor**: `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js` constructs successfully in Deno with no arguments. It uses Node-style `Readable`/`Writable`; when not passed, it defaults to process stdin/stdout (Deno’s Node compat provides these).
- **Connect + start**: `McpServer.connect(transport)` attaches to the transport and starts it. No separate `transport.start()` call is required; the SDK starts the transport as part of `connect()`.
- **Stdout/stderr**: The transport sends JSON-RPC over stdout. Logging in the stdio entry must go to stderr only (e.g. `console.error`) so protocol framing stays intact.
- **Session ID**: The stdio transport does not use `sessionIdGenerator` (unlike `WebStandardStreamableHTTPServerTransport`). For stdio we will inject a single process-scoped session ID via `createServer({ getSessionId: () => fixedId })`.
- **Adapter requirement**: None. Default constructor works in Deno; no custom stream adapter needed for normal execution.

## Lifecycle assumptions for implementation

1. Create `StdioServerTransport()` (no args).
2. Create server with `createServer({ getSessionId: () => stdioSessionId })`.
3. `await server.connect(transport)` — this starts the transport and begins reading stdin.
4. Server runs until stdin closes or process exits. Optional: run scavenge interval if `MCP_SESSION_TTL_MS` > 0 (same as HTTP).
5. All logs to stderr only.

## Evidence

- Manual run: `deno eval "import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'; import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'; const s = new McpServer({ name: 'x', version: '1.0.0' }); const t = new StdioServerTransport(); await s.connect(t); console.error('ok');"` — connects successfully; process waits on stdin.
- Parity smoke test (see `tests/unit/mcp-stdio-smoke.test.ts`) proves initialize + tools/list over stdio with session injection.
