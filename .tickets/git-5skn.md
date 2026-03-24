---
id: git-5skn
status: closed
deps: [git-y614]
links: []
created: 2026-03-24T05:35:41Z
type: chore
priority: 2
assignee: user.email
parent: git-wiud
---
# Tasks/docs sweep: topic deno tasks + string drift

**Naming authority:** use **`GITERLOPER_MCP_TEST_SESSION_PARENT`** and semantics from **`git-y614`** / specs (same as harness).

Update **`deno.json`** topic test tasks (`test:cli`, `test:mcp`, …) if needed so bypass runs either set session-parent via env, a small wrapper script, or documented **manual export**; grep sweep for hard-coded repo-root `.giterloper_test` assumptions in **docs, comments, and `tests/helpers/*.ts` implementation`** — **including** any helpers (`tests/helpers/gl.ts`, `cleanup.ts`, etc.) or CLI tests that assume session state lives under **`ctx.cwd/.giterloper_test`** while the harness now places it under `GITERLOPER_MCP_TEST_SESSION_PARENT` (coordinate with **`git-8qen`** for behavioral tests). Optional **`.rgignore`** for `tests/roots/`. Document **manual** `deno test` workflow (how env is set without unified harness).

**Coordination:** avoid contradicting harness sections updated in **`git-y614`** — split ownership: **y614** = harness behavior + repo-root hygiene policy; **5skn** = topic tasks + grep sweep + manual bypass narrative. Optional cross-reference **`git-8qen`** test paths once they exist.

## Acceptance Criteria

No stale user-facing claims vs new layout; `deno task` matrix coherent; manual bypass doc matches harness env name and intent.
