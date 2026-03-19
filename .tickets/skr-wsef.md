---
id: skr-wsef
status: closed
deps: [skr-gbqe]
links: []
created: 2026-03-19T20:46:24Z
type: chore
priority: 4
assignee: user.email
parent: skr-scn7
---
# Backlog: optional MCP remote mocking for speed (post-stabilization)

After topic layout and parallel suite are stable, consider reducing GitHub traffic in MCP tests via fixtures, recordings, or local bare repos. Not part of the initial refactor; capture as follow-up so the team does not block on it now.

## Acceptance Criteria

Ticket documents candidate approaches and acceptance for a future PR; no implementation required to close this ticket.

## Documentation (delivered)

- [docs/MCP_TEST_REMOTE_MOCKING.md](../docs/MCP_TEST_REMOTE_MOCKING.md) — problem statement, candidate approaches (local bare repos, fixtures, record/replay, tiered CI), layout constraints, and suggested future PR acceptance checklist.

## Closure

Doc-only backlog item: added `docs/MCP_TEST_REMOTE_MOCKING.md` with options and a future PR checklist; linked from `tests/README.md` and this ticket. No product code changes. Full suite: `deno check lib/gl.ts` and `deno run -A scripts/run-tests.ts` passed (75 tests).
