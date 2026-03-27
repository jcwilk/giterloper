---
id: git-pbau
status: open
deps: []
links: [git-cwzo]
created: 2026-03-27T01:29:31Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Align reconcile implementation with specs/reconciliation.md

**Authoritative contract:** `specs/reconciliation.md` (normative for **`gl reconcile`** and **`giterloper_reconcile_pending`**).

**Verified divergence:** Current `lib/reconcile.ts` is a **deterministic** topic-first merge (no LLM, no agent-assisted decomposition): it derives a topic from the first `#` heading or filename stem, groups pending by topic, writes **one** `knowledge/<topic>.md` per topic, and merges with append-style `mergeTopicContent` plus `## Sources`. That contradicts the spec’s **Integration (decomposition and placement)** MUSTs (LLM or equivalent agent-assisted decomposition; integrate throughout `knowledge/**/*.md` including **multiple** `.md` files and subdirectories; **MUST NOT** satisfy the contract by only merging each pending item into a **single** topic file keyed solely by first heading or filename stem). It also contradicts **Conflict resolution (incoming knowledge wins)** (incoming pending authoritative; conflicting **existing** corpus passages **MUST** be revised or removed—current behavior does not perform that revision/removal).

**Epic scope:** Close this divergence through child ticket(s): implementation, tests, and CLI/MCP user-visible string pairing per slice specs—**no** scope beyond alignment with `specs/reconciliation.md` and paired surfaces.

**Child:** `git-cwzo` (`parent: git-pbau` on that ticket).

## Acceptance (verifier-grade)

1. **`git-cwzo`** is **closed** with merged work that removes the **Verified divergence** (implementation, tests, pairing). If work is split, follow-up tickets stay under this epic until that closure is real in code and tests.
2. **Verification:** A verifier applying **`git-cwzo`** acceptance criteria against **`specs/reconciliation.md`** accepts the shipped reconcile path (including **Integration (decomposition and placement)** and **Conflict resolution (incoming knowledge wins)** MUSTs, not only ancillary polish).
3. No contradiction remains between **`specs/reconciliation.md`** and shipped reconcile behavior, modulo user-approved spec change (none assumed here).
