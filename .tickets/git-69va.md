---
id: git-69va
status: closed
deps: []
links: []
created: 2026-03-28T19:15:14Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Realign reconcile implementation to specs/reconciliation.md

**Completed on `reimplement_reconcile`.** Child work delivered: pending ordering from the git/GitHub paper trail (no stored epoch), one pending file per reconcile pass with a loop until the scoped queue is empty or the operation fails explicitly, optional memsearch-backed corpus context via a testable hook, **`## Sources`** provenance, atomic publish (no partial pin advance/push), empty-scope success with **`oldSha` === `newSha`** and empty **`touched`** / **`deleted`**, and failure paths that roll back without hiding partial work. Implementation and tests align with **specs/reconciliation.md** MUSTs cited under Acceptance Criteria.

## Acceptance Criteria

Children closed; deno task check and deno task test pass; behavior matches MUSTs in specs/reconciliation.md for ordering, batching, atomicity, **## Sources** / provenance, empty-scope structured success (**oldSha** === **newSha**, empty **touched**/**deleted**), and failure rollback (no partial publish).

## Children

- git-u9ax [closed] Reconcile: drop addEpoch; order pending via git/GitHub paper trail
- git-pc1c [closed] Reconcile: one pending per pass; loop until scoped queue empty or fail
- git-4p5w [closed] Reconcile: optional memsearch context + testable integration hook
