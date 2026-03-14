---
id: git-j6xv
status: open
deps: [git-mor9]
links: []
created: 2026-03-14T19:02:49Z
type: feature
priority: 1
assignee: user.email
parent: git-mowe
---
# Implement MCP intake tool for pending knowledge

Add MCP write tooling that accepts new markdown knowledge and places it into knowledge/_pending via existing branched pin write semantics.

## Design

Wrap current insert mechanics with MCP-safe schema and validation. Preserve append-only intake behavior and ensure writes advance branch state and return oldSha/newSha.

## Acceptance Criteria

- Client can submit markdown via MCP and file lands in knowledge/_pending.
- Operation returns updated state identifiers.
- Branch safety checks are enforced (no write on branchless pin, stale branch detection retained).
- Tool contract and implementation remain consistent.
