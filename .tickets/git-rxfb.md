---
id: git-rxfb
status: open
deps: [git-lpj8]
links: []
created: 2026-03-18T21:18:54Z
type: task
priority: 1
assignee: user.email
parent: git-0sqi
---
# Re-enable and harden omitted-pin MCP insert tests

Unignore and stabilize tests around omitted pin behavior for giterloper_insert_pending so regressions are caught before E2E. Ensure test coverage reflects actual MCP SDK behavior when optional pin is omitted and protects session-pin resolution semantics.

## Acceptance Criteria

1) tests/unit/mcp-insert-pending.test.ts no longer leaves the omitted-pin insert test ignored. 2) The test passes consistently and documents/asserts expected behavior for omitted pin in insert_pending. 3) If SDK behavior differs from expectation, tests and implementation are aligned to a single explicit contract.

