---
id: git-9bqz
status: open
deps: []
links: []
created: 2026-03-16T00:22:02Z
type: feature
priority: 1
assignee: user.email
parent: git-6wkq
---
# MCP protocol session lifecycle plumbing

Implement protocol-driven MCP sessions in lib/gl-mcp-server.ts: implicit session creation on initialize, session-id header propagation, resume via header, and rejection of tool calls without an active valid session.

## Acceptance Criteria

Initialize returns a session header; tool calls without a valid session fail with actionable guidance; session reuse by header is covered by tests.

