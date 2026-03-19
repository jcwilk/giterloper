---
id: git-iwfx
status: closed
deps: []
links: []
created: 2026-03-15T22:01:46Z
type: task
priority: 2
assignee: user.email
parent: git-0fof
---
# Audit MCP/HTTP error codes and wiring

Check that all MCP error codes (e.g. in mcpCodeToHttpStatus / McpErrorCode) can be produced by the application. Remove codes that are never produced; add coverage for any that should be. Ensure mcpCodeToHttpStatus is either used in the server response path or codes are trimmed to match what is actually produced (e.g. unauthorized and invalid_argument are produced by auth/tool handlers, not mapErrorToMcp).

