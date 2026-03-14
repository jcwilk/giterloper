---
id: git-mor9
status: open
deps: [git-1ua8, git-cu4d]
links: []
created: 2026-03-14T19:02:49Z
type: feature
priority: 0
assignee: user.email
parent: git-mowe
---
# Implement HTTP/SSE MCP server runtime

Add a standalone MCP server runtime for giterloper using HTTP/SSE transport only. No stdio transport should be introduced for parity reasons.

## Design

Create server entrypoint and routing layer that registers the tool contract from the spec ticket. Keep orchestration in MCP layer and delegate core behavior to library modules. Include startup config, health diagnostics, and deterministic error mapping.

## Acceptance Criteria

- Server boots locally and serves MCP over HTTP/SSE.
- Tool registration follows the contract ticket exactly.
- No stdio MCP mode is implemented.
- Existing CLI behavior remains intact.
