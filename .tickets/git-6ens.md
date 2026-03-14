---
id: git-6ens
status: open
deps: [git-mor9, git-dadj]
links: []
created: 2026-03-14T19:02:49Z
type: feature
priority: 1
assignee: user.email
parent: git-mowe
---
# Implement version-pinned MCP retrieval/search tools

Implement MCP read tools for semantic search and document retrieval against a specific knowledge state with explicit SHA attribution.

## Design

Tool handlers resolve target state via explicit sha or pin-head resolution then route through isolated index manager. Responses include effective pin, effective sha, and provenance for returned snippets/files.

## Acceptance Criteria

- Read tools support explicit pin+sha and pin-head resolution paths.\n- Every successful read response includes effective sha used.\n- Read paths honor stale-index guardrails from index manager.\n- Failure modes align with API contract ticket.

