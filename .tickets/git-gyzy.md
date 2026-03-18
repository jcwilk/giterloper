---
id: git-gyzy
status: open
deps: []
links: []
created: 2026-03-18T20:10:36Z
type: chore
priority: 2
assignee: user.email
parent: git-731r
---
# Remove makeState-without-sessionId unit test from gl-core.test.ts

The test 'makeState without sessionId uses shared .giterloper' (gl-core.test.ts lines 9-17) validates that makeState() without a sessionId returns paths rooted at the shared .giterloper/ directory, including .giterloper/pinned.yaml. This directly contradicts the high-priority truth that there should be NO shared/global pinned.yaml for any purpose. Remove this one test. Keep the remaining tests in the file: makeState with sessionId, validateSessionId accepts UUID-like, validateSessionId rejects empty, validateSessionId rejects invalid chars — all of which are correct and stable.

## Acceptance Criteria

The 'makeState without sessionId uses shared .giterloper' test is removed from tests/unit/gl-core.test.ts. The remaining 4 tests in the file pass. No assertion anywhere in the unit test suite references a non-session-scoped .giterloper/pinned.yaml path as expected correct behavior.

