---
id: git-ehx5
status: closed
deps: []
links: []
created: 2026-03-27T13:41:40Z
type: feature
priority: 1
assignee: user.email
parent: git-2j6d
---
# Implement LLM-backed reconciliation pipeline

Align **lib/reconcile.ts** (and any new modules) with **specs/reconciliation.md** for **pending→corpus integration**: **Integration (decomposition and placement)** and **Integration completeness and atomicity** — integration success must be **LLM-backed**; **MUST NOT** fall back to non-LLM integration and report success. **Other** sections of **specs/reconciliation.md** (e.g. provenance, ordering, structured results) remain in scope **only** where existing code already claims to implement them or this change must touch them to satisfy the integration MUSTs; do not expand scope beyond what the spec and current **lib/reconcile.ts** surface require for a compliant LLM integration path.

**Verifier scope (this ticket):** **specs/reconciliation.md** — LLM integration, completeness/atomicity, and **On failure** as they apply to the integration pipeline. **Not** CLI/MCP string parity or **specs/mcp.md** tools table (**git-1il6**).

## Scope

- Use an LLM for substantive integration work per spec: placement, deduplication, merging, revision of corpus text — not only classification/routing while writes stay heuristic.
- Meet the spec’s **gardening on write** / merge quality expectations; do not produce integrated corpus content by deterministic-only rules that bypass LLM inference for the integration step.
- On LLM unavailability or invocation failure: **bail** per spec (**On failure**): no partial publish, no silent non-LLM success.

## Out of scope

- Rewriting unrelated MCP transport, HTTP, or session plumbing.
- **User-visible** CLI/MCP copy and **specs/mcp.md** / **specs/cli.md** normative pairing — **git-1il6**.
- **Comprehensive** test coverage, golden refresh, and MCP/CLI reconcile tests beyond what is needed to keep the **full suite green** after this implementation (**git-1il6** owns breadth and pairing-focused tests).

**Suite policy:** **`.cursor/agents/verifier.md`** requires a **green** check/test run for **implementation** tickets. Update or narrow tests **minimally** here so `deno task test` passes (e.g. mocks, adjusted expectations for LLM-backed success/failure). Defer **full** coverage, pairing edits, and tools-table work to **git-1il6**.

**Authoritative:** **specs/reconciliation.md** (LLM MUSTs and **On failure**).

## Acceptance criteria

- `deno task check` passes.
- `deno task test` passes (environment per **tests/README.md**), including **minimal** test updates under this ticket so the suite is green; deeper pairing/coverage work is **git-1il6**.
- No code path reports reconcile **success** without LLM-backed integration where the spec requires it; no “success via deterministic-only integration” path.
- Failure modes match **specs/reconciliation.md** for LLM missing/failed (no bogus success).
- **Verifier** yields **APPROVED** for this ticket against **specs/reconciliation.md** integration + **On failure** (see **Verifier scope** above), with a green full suite for this change set.
- Commit and push per project rules when closing (branch policy per **AGENTS.md**).

## Notes

**2026-03-27T14:41:18Z**

Implemented: lib/reconcile-llm.ts OpenAI Chat Completions JSON integration; reconcile() uses runLlmIntegration (integrationOverride | GITERLOPER_RECONCILE_LLM_TEST_STUB=1 | OpenAI with OPENAI_API_KEY or GITERLOPER_RECONCILE_OPENAI_API_KEY). Production path requires real LLM or fails; test harness defaults stub. Added violatesSingleTopicFileShortcut check. Extended core tests; run-tests/deno-test-topic/mcp-subprocess forward stub.
