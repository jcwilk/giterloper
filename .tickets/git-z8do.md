---
id: git-z8do
status: open
deps: []
links: []
created: 2026-03-24T06:21:21Z
type: task
priority: 3
assignee: user.email
---
# createMcpAppForTest: optional sessionParent override for parallel in-process tests

Parallel in-process MCP tests share process env; today they use withIsolatedGiterloperProjectRoot for serialization. Add explicit sessionParent (and/or projectRoot) on CreateMcpAppForTestOptions / createServer when env coupling becomes painful.

## Acceptance Criteria

Options align with specs/core.md session layout; in-process tests can set overrides without global env; docs or tests/README note if behavior changes.

