---
id: git-1il6
status: closed
deps: [git-ehx5]
links: []
created: 2026-03-27T13:41:43Z
type: feature
priority: 2
assignee: user.email
parent: git-2j6d
---
# Reconcile tests and CLI/MCP pairing for LLM-backed integration

**Blocked on:** **git-ehx5** (implementation must land first; `./tk dep` matches frontmatter).

Bring automated tests and user-visible reconcile surfaces in line with **specs/reconciliation.md** and paired slices (**specs/cli.md**, **specs/mcp.md**).

## Scope

- **Tests:** Update **tests/core/reconcile.test.ts**, **tests/cli/**, **tests/mcp/** as needed. Use mocks/fakes/fixtures for LLM calls so CI stays deterministic. Assert that when the LLM cannot run or fails per contract, reconcile does **not** claim success. Remove or replace assertions that encode legacy deterministic-only success.
- **Pairing:** **gl reconcile** help/usage (e.g. **lib/gl.ts** `cmdReconcile`) and **giterloper_reconcile_pending** title/description (**lib/gl-mcp-server.ts**) must accurately describe LLM-backed integration. Update **specs/cli.md** and **specs/mcp.md** (including the MCP tools table and any other normative reconcile strings) so they stay in sync with code and **specs/reconciliation.md** — routine pairing edits alongside **lib** changes, not a separate spec-change round.

**Authoritative:** **specs/reconciliation.md**; applicable CLI/MCP slice sections for reconcile.

## Acceptance criteria

- `deno task check` and `deno task test` pass when prerequisites in **tests/README.md** are satisfied.
- Tests cover the LLM-backed contract and failure behavior without requiring a live model in CI.
- User-visible reconcile strings and **specs/cli.md** / **specs/mcp.md** (tools table and related) align with implementation and **specs/reconciliation.md**; **verifier** yields **APPROVED** for pairing and reconcile test coverage across CLI/MCP/reconciliation slices.
- Commit and push per project rules when closing.

**Verifier scope (this ticket):** Pairing (**specs/cli.md**, **specs/mcp.md**), breadth/quality of **tests/** for reconcile, and consistency of those surfaces and tests with **specs/reconciliation.md**. Core **lib** reconciliation pipeline behavior against **specs/reconciliation.md** is **git-ehx5**; here, verifier re-checks reconciliation **only** where CLI/MCP/tests expose it (not a second full pass on **lib/reconcile.ts** unless gaps appear).
