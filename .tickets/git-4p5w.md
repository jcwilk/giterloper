---
id: git-4p5w
status: closed
deps: [git-pc1c]
links: []
created: 2026-03-28T19:15:20Z
type: feature
priority: 2
assignee: user.email
parent: git-69va
---
# Reconcile: optional memsearch context + testable integration hook

specs/reconciliation.md Integration (agentic): **MAY** unfold units, **MAY** use memsearch for relevant corpus context; **MUST** be well-defined and directly testable (memsearch remains optional product behavior). Add integration path hooks (e.g. search-backed context retrieval before LLM) where feasible; document entry point for tests to iterate on agentic behavior without relying only on helper unit tests.

## Acceptance Criteria

Integration path exposes testable seam for retrieval+LLM; memsearch or index search used when available for context; tests can exercise behavior per specs/reconciliation.md Testing section themes.

