---
id: git-xgv2
status: open
deps: [git-tmna]
links: []
created: 2026-03-20T01:18:28Z
type: task
priority: 1
assignee: user.email
parent: git-0i1b
---
# Test-scoped cleanup; remove default suite-wide session/pin sweep

Remove cleanupLeakedTestPins (or equivalent) from the default run-tests happy path. Narrow cleanupTestKnowledgeRepo and related helpers so they only touch branches/pins/session dirs created by the current test context. Eliminate legacy cleanup modes that delete all non-main branches when parallel execution exists.

## Design

Optional debug-only leak tool may remain outside the default harness. tests/README.md describes test-scoped cleanup as the contract.

## Acceptance Criteria

scripts/run-tests.ts does not scan all .giterloper/* sessions for gle2e pins on success path (or replacement behavior is documented and scoped). No test relies on post-suite global sweep for correctness. Evidence: ./scripts/check_all.sh green; tests/README.md statements remain true.

