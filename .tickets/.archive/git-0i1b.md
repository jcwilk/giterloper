---
id: git-0i1b
status: closed
deps: []
links: []
created: 2026-03-20T01:18:19Z
type: epic
priority: 1
assignee: user.email
---
# Epic: Full test parallelism and flattened session layout

Deliver the architecture in docs/TEST_PARALLELISM_PLAN.md: .giterloper/<sessionId>/ only (no sessions/ wrapper), per-test isolation (temp cwd + context), MCP/config injection in tests (no mutable Deno.env), test-scoped cleanup, bounded worker pool over logical test cases (generated modules), single unified parallel suite via deno task test / run-tests.ts.

## Acceptance Criteria

Epic complete when child tickets are closed and definition-of-done in docs/TEST_PARALLELISM_PLAN.md is satisfied (AGENTS.md + tests/README.md already describe target behavior).

