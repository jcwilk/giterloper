---
id: git-kiwl
status: closed
deps: [git-mp36]
links: []
created: 2026-03-18T20:11:16Z
type: chore
priority: 1
assignee: user.email
parent: git-731r
---
# Skip CLI E2E tests that rely on global pinned.yaml

Three CLI E2E test files operate entirely against the shared .giterloper/pinned.yaml via CLI commands (runGlJson, runGlMaintenanceJson). Every test in these files uses 'pin add', 'pin list', 'pin remove' against the global path. Per truth #1 (no shared/global pinned.yaml), this is wrong. These tests validate CLI behavior that itself needs to change.

Files and test counts:
- tests/e2e/gl-knowledge.test.ts (11 tests): stage, write, promote, diagnostic, verify, stage-cleanup, stage-reuse, pin list, pin remove, pin update, status
- tests/e2e/gl-write-ops.test.ts (4 tests): insert, install-remote, reconcile, insert-with-name
- tests/e2e/gl-branching.test.ts (9 tests): branchless insert/promote fail, branch creation, stale detection, merge

Mark all tests in these three files as ignored (Deno.test { ignore: true }) with a comment referencing that they depend on global pinned.yaml which is being removed. This preserves the test logic as documentation for when the CLI is sessionized.

## Acceptance Criteria

1. All tests in gl-knowledge.test.ts, gl-write-ops.test.ts, gl-branching.test.ts are marked ignore: true.
2. Running the full E2E suite (deno run -A scripts/run-e2e.ts) does not execute any of these 24 tests.
3. Each ignored test has a comment explaining the skip reason (e.g. 'depends on global pinned.yaml, skip until CLI sessionized').
4. No test files are deleted — the test logic is preserved as reference.

