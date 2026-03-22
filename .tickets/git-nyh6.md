---
id: git-nyh6
status: open
deps: [git-y5f0]
links: []
created: 2026-03-22T03:10:24Z
type: task
priority: 0
assignee: user.email
parent: git-t6y7
---
# MCP: stdio+HTTP startup, options, /health + state_inspect observability

Wire mcpTestMode and effective remote into createServer/createHttpMcpApp/gl-mcp-server-stdio entrypoints. Startup MUST fail fast if the env var for the active mode is missing/invalid. GET /health JSON includes mcpTestMode + configuredKnowledgeStoreRemote. giterloper_state_inspect success payloads include the same fields (stdio parity). createMcpAppForTest / CreateServerOptions expose test mode + remote overrides per specs/MCP.md.

## Design

**`git-t6y7` scope only:** first-class MCP stdio + HTTP **`createServer`** wiring, observability, and minimal tests. **Not** responsible for Docker/Fly/auxiliary launchers — those are **`git-a4f4`**.

## Acceptance Criteria

At least one tests/mcp/ case for HTTP /health and one for stdio (or in-process tool) asserting expected remote + mcpTestMode when test harness enables test mode. Parity: both transports report identical semantics.

