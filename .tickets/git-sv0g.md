---
id: git-sv0g
status: open
deps: [git-kmbs, git-34am]
links: []
created: 2026-03-18T23:01:44Z
type: task
priority: 2
assignee: user.email
parent: git-tsxe
---
# Update E2E test helpers and re-enable skipped CLI E2E tests

CLI now defaults to session _cli, so all CLI-driven E2E tests write to .giterloper/sessions/_cli/. Update helpers and re-enable tests.

Test helpers (tests/helpers/gl.ts): runGl and runGlMaintenance should accept optional sessionId param and pass --session-id to CLI args when provided.

Test helpers (tests/helpers/cleanup.ts lines 39-41): cleanupLocalCopies uses path.join(root, '.giterloper', 'versions', pinName) — update to session-rooted path (e.g. .giterloper/sessions/_cli/versions/...) or accept session id parameter.

Reference client (reference_client/test_helpers.ts): runGlJson (lines 50-62), runGlMaintenanceJson (lines 64-76), cleanupLocalCopies (lines 90-92), addTestPin (lines 159-176), ensurePinRemoved (lines 85-87) all hardcode shared .giterloper/ paths. Update to pass --session-id and use session-rooted paths for local cleanup.

E2E path helpers in test files: stagedDir() and cloneDir() in gl-knowledge.test.ts (lines 31-37), gl-write-ops.test.ts (lines 23-24), gl-branching.test.ts (lines 25-26) use path.join(Deno.cwd(), '.giterloper', ...). Update to .giterloper/sessions/_cli/....

Re-enable skipped tests: gl-knowledge.test.ts (11 tests), gl-write-ops.test.ts (4 tests), gl-branching.test.ts (9 tests), reference_client/tests/client.test.ts (5 tests). Remove ignore: true and skip comments.

Update scripts/run-e2e.ts: line 4 comment about lock. cleanupLeakedTestPins (lines 15-38) will automatically target _cli session after CLI change — verify this works.

## Acceptance Criteria

All 29 previously skipped CLI E2E tests are enabled (no ignore: true). deno run -A scripts/run-e2e.ts passes. No E2E helper references shared .giterloper/ paths for mutable state.

