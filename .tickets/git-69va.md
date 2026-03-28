---
id: git-69va
status: open
deps: []
links: []
created: 2026-03-28T19:15:14Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Realign reconcile implementation to specs/reconciliation.md

Normative spec (commit 7d07c48 area) removes addEpoch, requires one pending file per pass with iteration until scope is cleared, paper-trail/GitHub ordering, and agentic integration with optional memsearch. Code in lib/reconcile.ts and lib/reconcile-llm.ts still uses addEpoch, batches all pending into one LLM call, and does not implement the per-pass loop or memsearch-backed context. Track implementation and test updates here.

## Acceptance Criteria

Children closed; deno task check and deno task test pass; behavior matches MUSTs in specs/reconciliation.md for ordering, batching, atomicity, **## Sources** / provenance, empty-scope structured success (**oldSha** === **newSha**, empty **touched**/**deleted**), and failure rollback (no partial publish).

