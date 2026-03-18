---
id: git-u0yq
status: open
deps: [git-cfli]
links: []
created: 2026-03-18T23:01:17Z
type: task
priority: 2
assignee: user.email
parent: git-tsxe
---
# Remove FIFO lock from mutatePins and update error messages

In lib/pinned.ts mutatePins (lines 118-124): the branch that uses withFifoLock when !state.sessionId is now dead code since all callers have a session id. Remove the branch — all mutations call doMutatePins directly. Each session has its own pinned.yaml so no cross-process contention exists. Update error message on line 146 that says 'For CLI: ensure .giterloper/pinned.yaml contains a pin named _session' to reference the session-rooted path instead. Check if withFifoLock in lib/locking.ts has any remaining callers. If not, either remove it or update its JSDoc (line 2: 'FIFO lock for coordinated access to shared resources').

## Design

mutatePins always calls doMutatePins directly. The FIFO lock code path is removed. Error messages no longer reference .giterloper/pinned.yaml as a shared/global path.

## Acceptance Criteria

mutatePins has no branching on state.sessionId. No code calls withFifoLock for pinned.yaml writes. Error message in resolvePin references session-scoped paths. deno check lib/gl.ts passes.

