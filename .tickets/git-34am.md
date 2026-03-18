---
id: git-34am
status: open
deps: [git-cfli]
links: []
created: 2026-03-18T23:01:27Z
type: task
priority: 2
assignee: user.email
parent: git-tsxe
---
# Fix unit tests for session-only GlState

GlState.sessionId is now required (string, not optional). Update all unit tests that construct GlState objects without sessionId. Files: tests/unit/paths.test.ts (lines 18-28, 31-41, 43-56) — add sessionId: 'test' to three mock GlState objects. tests/unit/pinned.test.ts (lines 52-58, 76-82, 106-112, 128-134) — add sessionId: 'test' to four GlState objects. tests/unit/read-tools.test.ts (lines 11-19) — add sessionId: 'test' to local makeState helper. tests/unit/memsearch-adapter.test.ts (lines 16-28) — add sessionId: 'test' to local makeState helper. tests/unit/mcp-error-mapping.test.ts (line 45) — update error string if the error message text changed in pinned.ts. tests/unit/gl-core.test.ts — already session-scoped, no change needed but consider adding a test that makeState('_cli') returns paths under sessions/_cli/. tests/unit/pin-lifecycle.test.ts — already has sessionId, no change needed.

## Acceptance Criteria

deno test -A tests/unit/ passes. No unit test constructs GlState without sessionId.

