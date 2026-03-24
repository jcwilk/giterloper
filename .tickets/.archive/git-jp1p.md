---
id: git-jp1p
status: closed
deps: [git-toud]
links: []
created: 2026-03-24T05:35:41Z
type: feature
priority: 1
assignee: user.email
parent: git-wiud
---
# tests/roots: allocate run dir + stale GC (PID+fingerprint)

Add **`.gitignore`** entry for **`tests/roots/`** (entire subtree).

**Layout:** allocate under `tests/roots/giterloper-test-runs/` (or one fixed constant — document in `tests/README`) a new per-harness-invocation directory; write a **manifest** (owner PID + start-time fingerprint) using the **same stale semantics** as `scripts/harness-orchestrator-lock.ts` — prefer **importing/exporting shared helpers** (`HarnessOrchestratorRecord`, `isHarnessOrchestratorRecordStale`, or factored shared module) so rules do not diverge.

**GC:** before creating a new run dir, scan **only** the managed prefix; remove directories **provably stale** (dead PID or fingerprint mismatch); **never** signal/kill live processes; **never** delete outside `tests/roots/`. **Non-Linux:** document the same PID-reuse window as the harness lock. **Bounded GC:** pick and document concrete caps (max removals + max entries scanned per invocation) in `tests/README`.

**Stable API for `git-y614`:** export a small callable surface from an agreed module path (e.g. `scripts/test-run-roots.ts` or `lib/test-run-roots.ts`) such as **`allocateTestRunRoot(repoRoot: string): Promise<{ absoluteParent: string }>`** (names adjustable in implementation) that performs GC + mkdir + manifest write and returns the **absolute** path to pass to `GITERLOPER_MCP_TEST_SESSION_PARENT`.

**Scope:** does **not** change `run-tests.ts` repo-root `.giterloper` / `.giterloper_test` deletion — **`git-y614`** owns harness wiring and hygiene policy.

## Acceptance Criteria

- `tests/roots/` gitignored; allocator + GC implemented with tests (`tests/core/` or scripts test per repo conventions).
- Manifest format and GC bounds documented in `tests/README.md` (aligned with `git-xaio` env story).
- Stale rules aligned with `harness-orchestrator-lock.ts` (no parallel ad-hoc PID logic).
