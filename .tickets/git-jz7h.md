---
id: git-jz7h
status: open
deps: [git-mp36]
links: []
created: 2026-03-18T20:11:24Z
type: chore
priority: 2
assignee: user.email
parent: git-731r
---
# Skip reference client E2E tests that rely on global pinned.yaml

reference_client/tests/client.test.ts (5 tests: state_inspect, search, retrieve, insert+reconcile, merge) uses addTestPin() from test_helpers.ts which calls CLI commands (runGlJson 'pin add', runGlMaintenanceJson 'stage'/'promote') writing to the shared .giterloper/pinned.yaml. The ensurePinRemoved helper also reads/writes global state. Per truth #1, this is wrong.

Mark all tests in this file as ignored with a comment. Preserve the test logic and the reference client library (client.ts) which is correct and used by the MCP workflow E2E test.

## Acceptance Criteria

1. All tests in reference_client/tests/client.test.ts are marked ignore: true.
2. Each test has a comment explaining the skip reason.
3. reference_client/client.ts is NOT modified (it is correct and used elsewhere).
4. No files deleted.

