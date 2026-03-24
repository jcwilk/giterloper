---
id: git-wiud
status: open
deps: []
links: []
created: 2026-03-24T05:35:32Z
type: epic
priority: 2
assignee: user.email
---
# Epic: MCP test session isolation under tests/roots (per-run dirs + GC)

Per cross-critique consensus (4 lanes): bypass `deno test` / topic tasks still share repo-root `.giterloper_test`; add optional dedicated **session-parent** env (**not** `GITERLOPER_PROJECT_ROOT`) so the literal `.giterloper_test` segment lives under `tests/roots/<run>/` (entire `tests/roots/` tree **gitignored**). **PID + start-time fingerprint** stale GC (reuse / share rules with `scripts/harness-orchestrator-lock.ts`). **Session-parent env** must propagate to harness **workers** and to spawned **`gl` / MCP** test processes (merged child env). Specs, `tests/README.md`, and helpers stay paired. **`GlState.projectRoot`** / constitution / retry-log semantics stay tied to the **repository root**, not the per-run session tree.

**Outcomes:** canonical harness allocates one run dir per suite invocation; manual runs can opt in via env; reconcile repo-root `.giterloper*` hygiene vs bypass paths (`git-y614` + `git-5skn`). **Residual:** in-process MCP parallel cases vs global env may need a follow-up factory option if not closed in this epic.
