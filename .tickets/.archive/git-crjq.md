---
id: git-crjq
status: closed
deps: []
links: []
created: 2026-03-24T04:15:53Z
type: task
priority: 2
assignee: user.email
parent: git-05a6
---
# MCP stdio smoke: teardown for with-memsearch inner Deno

mcp-stdio-smoke.test.ts uses Deno.Command with denoArgsForMcpStdioServer (outer Deno runs scripts/with-memsearch.ts, inner runs gl-mcp-server-stdio). child.kill(SIGTERM) may not reap the inner server. Mirror tests/helpers/mcp-subprocess HTTP process-group teardown or consolidate on a shared spawn helper.

