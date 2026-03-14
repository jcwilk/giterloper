---
id: git-1ua8
status: open
deps: []
links: []
created: 2026-03-14T19:02:49Z
type: feature
priority: 0
assignee: user.email
parent: git-mowe
---
# Specify MCP API contracts and state semantics

Define the MCP-facing contract for giterloper over HTTP/SSE, including tool names, request/response schemas, error envelopes, and state-id semantics. The contract must enforce version-pinned operations tied to pin+sha and return effective SHA on all read/write operations.

## Design

Produce a contract-first specification covering: server transport assumptions (HTTP/SSE only), tool list, required arguments, backward-compatible schema evolution rules, and concurrency expectations. Explicitly define how a request chooses state (explicit sha vs pin head resolution) and how write operations report oldSha/newSha.

## Acceptance Criteria

- Spec includes tool-level schema for search, retrieve, insert pending, reconcile, and state inspection.\n- Every response shape includes state attribution fields where applicable.\n- Error cases are enumerated (missing pin, stale index, mismatched sha, branchless write, reconciliation conflict).\n- Spec is implementation-ready and referenced by dependent tickets.

