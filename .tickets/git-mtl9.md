---
id: git-mtl9
status: closed
deps: [git-ftwq]
links: []
created: 2026-03-20T01:18:24Z
type: task
priority: 1
assignee: user.email
parent: git-0i1b
---
# MCP/auth/bootstrap config injection for tests (no Deno.env mutation)

Refactor createServer, createHttpMcpApp, createMcpAppForTest, mcp-auth, autoInitSessionPin / KNOWLEDGE_STORE_REMOTE handling, and session-store TTL/config so tests pass explicit config objects. Remove Deno.env.set/delete from tests/mcp and reference_client tests for MCP auth, insecure mode, and remote bootstrap.

## Design

Production entrypoints may read env once at startup and build config. Tests construct config in-process. Parity: both HTTP and stdio transports stay in sync via shared createServer core per MCP.md.

## Acceptance Criteria

Grep tests/mcp and reference_client: no Deno.env.set or Deno.env.delete for MCP_INSECURE, MCP_TOKEN, KNOWLEDGE_STORE_REMOTE in test bodies (child process env for spawned server is OK if parent process env is not mutated). MCP unit and workflow tests pass. Evidence: ./scripts/check_all.sh green.

