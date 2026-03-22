---
id: git-6g05
status: open
deps: [git-9btr]
links: []
created: 2026-03-22T00:21:38Z
type: task
priority: 1
assignee: user.email
parent: git-zbfq
---
# Author specs/MCP.md; retire root MCP.md as normative source

Create specs/MCP.md as the top of the product-truth hierarchy for MCP (not a quick agent cheat sheet): rewrite from scratch for abstract contracts—tools, sessions, transports parity through shared core, auth/error shapes at the level appropriate to this layer. Agent-facing progressive discovery should rely on MCP tool descriptions and runtime behavior, not this file. Replace root MCP.md: remove normative content there (delete file or replace with a short non-normative pointer to specs/MCP.md per repo convention) and update all in-repo references to the new path. Initial pass: strict coverage of topics implied by tests/mcp/* plus transport/session/tool semantics that belong in this slice. Keep length ~2 pages; overlap with other specs minimal and non-contradictory.

## Acceptance Criteria

specs/MCP.md exists and is canonical for MCP product behavior; root MCP.md no longer competes as normative; references updated; strict coverage vs tests/mcp themes.

