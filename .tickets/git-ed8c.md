---
id: git-ed8c
status: open
deps: []
links: []
created: 2026-03-24T03:39:44Z
type: feature
priority: 0
assignee: user.email
parent: git-05a6
---
# PID-based mutex for unified test harness (stale-safe)

Implement mutual exclusion so a second invocation of the **canonical unified test harness** cannot run while the first is active. **Scope:** `scripts/run-tests.ts` only (`deno task test`). `scripts/check-all.ts` / `./scripts/check_all.sh` inherit mutex **only** because they invoke `run-tests.ts` after typecheck—**two concurrent `deno check` runs may still overlap**; that is out of scope unless explicitly expanded later.

**Lock path (critical):** The harness **recursively deletes** repo-root `.giterloper` and `.giterloper_test` before workers start (`run-tests.ts`). The lock file **must not** live under those trees (they are wiped each run). Use a **repo-root** gitignored file (e.g. `.giterloper-harness.lock`) or another path **outside** those directories.

Requirements:
- Store owning PID (and optionally start time / short command snippet for diagnostics).
- **Atomic acquisition:** two starters must not both proceed (e.g. exclusive create `O_EXCL`, or `flock` on the lock file, or equivalent documented pattern) before writing PID; then validate stale locks by PID liveness.
- If lock exists: read PID; if process is alive, exit non-zero with a clear message pointing to the other PID; if PID is dead or stale, remove lock and proceed.
- Take the lock only in the parent **run-tests.ts** process—not in each per-case `deno test` subprocess.
- Release lock in `finally` on normal exit (success or failure); handle SIGINT/SIGTERM where practical. Stale recovery covers `kill -9` on the harness parent.
- **PID liveness is mandatory** (file marker alone is insufficient). Linux primary; document macOS if behavior differs.

**Ordering:** Acquire mutex early enough to fail fast before scheduling workers, after repo `root` resolution; compose with existing `ensureMemsearchOnPath()` and discovery—document final order in tests/README.md.

**Bypass:** Direct `deno test tests/...` or `deno task test:cli` etc. do not use this mutex; document that mutex is **canonical full suite** only.

Governing docs: tests/README.md (harness, isolation). Mutex prevents concurrent harnesses from deleting `.giterloper*` while another harness’s workers run.

## Acceptance Criteria

- Mutex at `run-tests.ts` entry; `check-all` path inherits via subprocess invocation.
- Lock file **outside** `.giterloper`/`.giterloper_test`, **gitignored** explicitly at repo root if needed.
- Atomic lock + stale-PID cleanup; manual demo: second terminal refused while first runs; `kill -9` first → next start clears stale lock and passes.
- Documented in tests/README.md harness section; `./scripts/check_all.sh` passes.

