---
id: skr-vakd
status: closed
deps: [skr-jx74, skr-7uqk]
links: []
created: 2026-03-19T20:46:24Z
type: feature
priority: 1
assignee: user.email
parent: skr-scn7
---
# Migrate former e2e CLI scenarios into cli/core tests; keep MCP as higher-level integration

Split responsibilities per user intent: MCP-focused tests cover the real end-to-end agent path (HTTP or stdio client against MCP server, live remote as today). Command-line gl and gl-maintenance flows that currently live under tests/e2e move into tests/cli/ (or tests/core/) as faster, parallel-friendly tests using session helpers. Remove the framing that every git-remote scenario is e2e; each CLI subcommand-sized behavior should be unit-testable with injected configuration. Preserve behavioral coverage—no silent drops—map old cases to new locations in ticket notes. Live GitHub/API usage remains acceptable for MCP integration tests during this refactor; adding mocks or recordings for MCP remote calls is explicitly out of scope until structure stabilizes.

## Acceptance Criteria

Former e2e CLI files removed or reduced to thin MCP-only wrappers; coverage list in ticket notes maps old tests → new paths; MCP suite still exercises pin_set/insert/reconcile/retrieve/merge paths against real remote per current policy; verifier can run full suite.

## Coverage map (former `tests/e2e/` → topic suites)

There is no remaining `tests/e2e/` tree; the runner is `scripts/run-tests.ts` (invoked by `./scripts/check_all.sh` and `deno task test`).

| Former path | New path | Coverage |
|-------------|----------|----------|
| `tests/e2e/gl-knowledge.test.ts` | `tests/cli/gl-knowledge.test.ts` | Stage/write/promote, diagnostic, verify, stage-cleanup, stage reuse, pin list/remove/update, status (per-file `sessionId` via `newTestCliSessionId()`) |
| `tests/e2e/gl-write-ops.test.ts` | `tests/cli/gl-write-ops.test.ts` | `insert`, `install-remote`, `reconcile`, `insert` with `--name` |
| `tests/e2e/gl-branching.test.ts` | `tests/cli/gl-branching.test.ts` | Branchless insert/promote failures, `pin add` branch creation, stale branch/SHA detection, `merge` via GitHub API |
| `tests/e2e/gl-mcp-workflow.test.ts` | `tests/mcp/gl-mcp-workflow.test.ts` | MCP-only HTTP client: `pin_set`, `insert_pending`, `reconcile`, `retrieve`, snapshot isolation (no CLI) |

**Additional MCP integration** (contracts and tools, live remote where noted): `tests/mcp/mcp-pin-set.test.ts`, `mcp-insert-pending.test.ts`, `mcp-merge.test.ts`, `mcp-session-lifecycle.test.ts`, `mcp-stdio-smoke.test.ts`, etc.

**Core (local / library):** `tests/core/` — paths, pinned state, queues, reconcile helpers, memsearch adapter, and related behavior without duplicating full CLI/MCP workflows.


## Notes

**2026-03-19T21:52:05Z**

Closure: Confirmed layout already migrated (no tests/e2e). Added coverage map table to ticket body. Docs/comments reframe CLI/MCP remote tests as topic integration (not a separate e2e suite); E2E_MARKER note clarified in tests/README. ./scripts/check_all.sh green (127 tests).
