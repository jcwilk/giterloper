---
id: git-0sqi
status: open
deps: []
links: []
created: 2026-03-18T21:18:45Z
type: epic
priority: 1
assignee: user.email
---
# Epic: Restore full check_all pass for session pin writes

Get ./scripts/check_all.sh passing again by fixing session-pin write path regressions and restoring deterministic test coverage around omitted pin behavior in MCP insert/reconcile flows. Current blocker is deterministic E2E failure in tests/e2e/gl-mcp-workflow.test.ts with reserved-name error for _session during insert_pending path.

