---
id: git-sdqd
status: closed
deps: []
links: []
created: 2026-03-17T02:13:01Z
type: task
priority: 2
assignee: user.email
parent: git-y28q
---
# MCP: Rename giterloper_reconcile to giterloper_merge

Rename MCP tool giterloper_reconcile to giterloper_merge so merge behavior is explicit and no longer confused with giterloper_reconcile_pending.

## Acceptance Criteria

- MCP exposes `giterloper_merge` with the current merge behavior and argument contract.
- References in descriptors, docs, and examples use `giterloper_merge`.
- A compatibility/deprecation path is defined for existing callers of `giterloper_reconcile`, or a migration note is provided.
- No ambiguity remains between merge and pending-reconcile tool names.

