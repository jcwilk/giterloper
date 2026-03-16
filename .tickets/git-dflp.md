---
id: git-dflp
status: open
deps: [git-odv6]
links: []
created: 2026-03-16T20:41:56Z
type: feature
priority: 1
assignee: user.email
parent: git-jwl2
---
# Extract MCP shared server core

Move transport-agnostic MCP server construction and tool registration into a shared core module with injectable session-id resolution. Ensure schemas, payloads, and error mapping remain unchanged from current behavior.

## Acceptance Criteria

- Shared core owns tool registration and state/session resolution\n- Session-id resolver supports transport-specific injection with safe default\n- Existing MCP behavior remains contract-compatible

