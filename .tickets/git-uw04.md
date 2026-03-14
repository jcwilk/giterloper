---
id: git-uw04
status: open
deps: [git-6ens, git-j6xv, git-893e, git-fqhi, git-76vk]
links: []
created: 2026-03-14T19:02:49Z
type: task
priority: 1
assignee: user.email
parent: git-mowe
---
# Add MCP E2E workflow tests using test knowledge repo

Add end-to-end tests for MCP read/intake/reconcile flows against github.com/jcwilk/giterloper_test_knowledge with collision-safe branch/pin naming.

## Design

Mirror existing E2E safety practices: random RUN_ID entropy, branch isolation, cleanup that only removes test-run branches. Ensure tests validate state-id transitions before and after writes/reconcile.

## Acceptance Criteria

- E2E tests cover read -> intake -> reconcile -> read loop.\n- All E2E tests target giterloper_test_knowledge only.\n- Tests remain parallel-safe and clean up their own branch artifacts.\n- State-id behavior is asserted across transitions.

