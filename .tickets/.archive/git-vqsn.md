---
id: git-vqsn
status: closed
deps: []
links: []
created: 2026-03-23T05:12:17Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Align tests with post–pin-semantics spec layout

Commit 8a61492 split pin / giterloper_pin_set normative text into specs/pin-semantics.md, moved harness-only MCP rules from specs/MCP.md into tests/README.md, and moved use-cases to docs/use-cases.md. Executable contracts unchanged, but the test tree and comments must match the new spec boundaries and avoid duplicate discovery. Authoritative: specs/pin-semantics.md, specs/MCP.md, specs/core.md, tests/README.md, HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md (spec↔test pairing).

## Children

- **git-1ooc** — Remove duplicate `tests/pin/` tree (same files as `tests/mcp/` + `tests/core/pin-lifecycle`).
- **git-knna** — Update `tests/mcp/mcp-pin-set.test.ts` and `tests/mcp/mcp-merge.test.ts` block comments to cite `specs/pin-semantics.md` (depends on git-1ooc).
- **git-vv7p** — Refresh `tests/README.md` MCP/pin normative pointers for the three-way split.

Close epic when all children are closed and `deno task test` is green.

