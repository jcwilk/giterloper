---
id: git-dsgd
status: closed
deps: [git-1ua8, git-mor9]
links: []
created: 2026-03-14T19:07:25Z
type: feature
priority: 1
assignee: user.email
parent: git-mowe
---
# Add MCP authn/authz baseline and policy hooks

Introduce a minimal authentication/authorization baseline for MCP access so giterloper can enforce read vs write permissions and keep the knowledge store private behind the server boundary.

## Design

Implement a simple, configurable auth layer for MCP HTTP/SSE (for example token-based identity with policy hooks). Start minimal: deny unauthenticated requests by default unless explicitly configured for local dev, and provide per-tool or read/write policy checks. Keep this extensible, not overbuilt.

## Acceptance Criteria

- MCP server supports an authentication mechanism suitable for remote deployment.
- Authorization policy can distinguish read tools from write/reconcile tools.
- Unauthorized requests fail with deterministic error responses.
- Local development path is documented (explicit opt-in insecure mode or test credentials).
