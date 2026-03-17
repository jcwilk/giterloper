---
id: git-k1gj
status: open
deps: []
links: []
created: 2026-03-17T06:11:43Z
type: task
priority: 0
assignee: user.email
parent: git-amoh
---
# Remove bootstrapSessionFromShared, add ensureSessionDir in gl-core.ts

Remove bootstrapSessionFromShared entirely — sessions no longer copy shared pinned.yaml or version clones. Remove SHARED_PINNED, SHARED_VERSIONS constants and parsePinned import. Add ensureSessionDir(state) that only creates the session directory if missing. This is the only session-init function needed from gl-core.

## Design

ensureSessionDir: if !state.sessionId return; if !existsSync(state.rootDir) mkdirSync recursive. Remove bootstrapSessionFromShared export and all shared pinned constants.

## Acceptance Criteria

bootstrapSessionFromShared no longer exists. ensureSessionDir creates session dir. No code references SHARED_PINNED or SHARED_VERSIONS. Callers updated to use ensureSessionDir.

