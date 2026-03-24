---
id: git-n14t
status: open
deps: []
links: []
created: 2026-03-24T03:39:52Z
type: task
priority: 1
assignee: user.email
parent: git-05a6
---
# Audit: per-case parallelism and cross-suite races

Verify the harness still runs **one `deno test` subprocess per discovered logical case** `(path, name)` (`scripts/run-tests.ts` + `scripts/discover-test-cases.ts`), bounded by `DENO_JOBS`—not “one subprocess per `*.test.ts` file.” Note: duplicate test **names across different files** are OK because `--filter` is paired with a single `c.path`.

**Review:**
- Worker pool + `runOne` still match per-case scheduling.
- **GITERLOPER_PROJECT_ROOT** and other process-global env: grep tests for `Deno.env.set`/`delete`; confirm parallel cases do not race (see `tests/helpers/mcp-project-root-isolation.ts`, subprocess-only env where required).
- **`.giterloper_test` deletion** at harness start vs other actors—delegate **leaked MCP OS processes** to **git-7qgy**; here focus on **true concurrent orchestrators** (should be prevented by **git-ed8c** blocking lock), **bypass** paths (`deno task test:cli`, raw `deno test`), and harness vs long-lived external MCP.

**Verifier / flake narrative (closure note, ≥1 short paragraph):** With **git-ed8c**, second canonical harness invocations **block** instead of racing deletes; residual flake risk = **bypass** entrypoints, stale locks, or external MCP still touching `.giterloper_test`. Tie mitigations to **git-05a6** / **git-7qgy** as appropriate. Optional one-line pointer in verifier runbook only if maintainers want it—**not** required by default.

If bugs found: fix in this ticket or spawn a child with evidence. Optional **low-cost** invariant (e.g. discovery fixture test)—do not require heavy `Deno.Command` mocking.

## Acceptance Criteria

- Written audit + closure checklist: (1) per-case scheduling confirmed in code; (2) env/global mutation reviewed; (3) verifier flake hypothesis tied to **git-ed8c** / epic **git-05a6** and MCP leaks cross-ref **git-7qgy**.
- Any harness defect fixed with tests or child ticket.
- Do not duplicate **git-ed8c** mutex design or **git-7qgy** spawn inventory here.

