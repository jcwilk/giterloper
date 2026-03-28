---
id: git-u9ax
status: closed
deps: []
links: []
created: 2026-03-28T19:15:19Z
type: feature
priority: 1
assignee: user.email
parent: git-69va
---
# Reconcile: drop addEpoch; order pending via git/GitHub paper trail

specs/reconciliation.md: **no persisted epoch field**; derive order from git/GitHub on the fly; shallow clones may require GitHub API. Remove addEpoch from PendingEntry, comparePendingByAddEpoch, addEpochForFile naming, and getPendingInCommitOrder contract; replace with a function that sequences pending files per spec (same sources: git log vs GitHub Contents API as today but **without** a normative stored ordering field). Update lib/reconcile.ts, reconcile-llm.ts, tests/reconciliation/*.

## Acceptance Criteria

No addEpoch in public types or spec-facing docs in code comments that contradict specs/reconciliation.md; pending ordering uses paper-trail/GitHub approach described in spec; unit tests updated.

