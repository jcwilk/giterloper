---
id: git-pc1c
status: closed
deps: [git-u9ax]
links: []
created: 2026-03-28T19:15:19Z
type: feature
priority: 1
assignee: user.email
parent: git-69va
---
# Reconcile: one pending per pass; loop until scoped queue empty or fail

specs/reconciliation.md Batching and overall success: at most one pending file per pass; CLI/MCP success only when all in-scope pending reconciled; atomic publish for the **overall** operation (no partial durable publish). Refactor reconcile() to **iterate passes locally**: pick next pending (ordered), run LLM integration for that single file per pass; **pin advance / push only after** the full scoped pending queue is cleared under success criteria—not one git commit per pass required. Update integrateCorpusWithOpenAi call pattern, VCR fixtures, gl-reconcile-e2e, MCP tests.

## Acceptance Criteria

Single pending per LLM integration pass; multiple passes until _pending empty for scope; tests cover multi-pending queue; structured output fields still match spec when operation completes.

