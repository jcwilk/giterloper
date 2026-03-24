---
id: git-ed8c
status: closed
deps: []
links: []
created: 2026-03-24T03:39:44Z
type: feature
priority: 0
assignee: user.email
parent: git-05a6
---
# Blocking orchestrator lock for unified test harness (stale-safe, multi-waiter stdout)

Implement **single active orchestrator** for the **canonical unified test harness** (`scripts/run-tests.ts`, i.e. `deno task test`). **Additional invocations must block** (not fail fast) until they can become the sole orchestrator—so agents can run the suite without choosing between “retry later” or killing peers.

**Scope:** `scripts/run-tests.ts` only. `scripts/check-all.ts` / `./scripts/check_all.sh` inherit behavior **only** via invoking `run-tests.ts` after typecheck—**two concurrent `deno check` runs may still overlap**; out of scope unless expanded later.

**Lock path (critical):** The harness **recursively deletes** repo-root `.giterloper` and `.giterloper_test` before workers start. The lock artifact **must not** live under those trees. Use a **repo-root** gitignored file (e.g. `.giterloper-harness.lock`) or equivalent **outside** those directories.

**Lock record:** Store **owning PID** plus **anti–PID-reuse fingerprint** (e.g. Linux start time from `/proc/<pid>/stat`; documented fallback on other OSes). Required for stale recovery and for accurate wait messages.

**Acquisition (blocking, queue-friendly):**
- Use **atomic exclusive lock** semantics so only one live orchestrator mutates shared harness state. **Deno caveat:** prefer **`flock(2)`** via a small documented mechanism (e.g. `flock(1)` subprocess, or FFI)—spell the chosen approach in tests/README.md. **If `flock(1)` is used:** the process that holds the lock **must stay alive for the entire harness run** (same open FD / same subprocess)—a try-then-exit wrapper **releases** the lock immediately and breaks mutual exclusion.
- **Record integrity vs waiter reads:** The **orchestrator** writes the PID+fingerprint record using an **atomic replace** (e.g. write temp + `rename` into place, or truncate+write+`fsync`) **after** it has acquired the exclusive lock (or in a defined order documented in tests/README). **Waiters** must **not** be required to take the **same** exclusive flock just to **read** who is running—while the orchestrator holds `LOCK_EX`, other processes can still `read(2)` the path if the OS allows; the ticket’s rule is **no torn writes**, not “all readers must hold the mutex.” Waiters: **non-blocking exclusive flock attempt** (or equivalent) on the lock **object** to decide when it is their turn; between attempts they **re-read** holder metadata from the atomically updated record and print stdout. (If implementers prefer **two files**—lock inode + sidecar metadata—that is fine as long as the contract is documented and stale-safe.)
- **Wait loop with stdout:** A **blocking** flock that never returns until acquired cannot print progress; use **non-blocking try-lock + sleep/backoff** (or equivalent) so waiters can emit **STDOUT** between attempts. **STDOUT** (not only stderr), e.g.  
  `Waiting for previous test suite orchestrator at PID <pid> to finish...`  
  First message promptly, then throttle (e.g. every few seconds) **and/or** emit when the **holder PID in the record changes**—document policy in tests/README.md.
- **Multi-waiter coordination:** After each failed acquire or observed lock release, **re-read** the holder identity; if **this process** still does not hold the lock because another waiter won the race, print e.g.  
  `Another process acquired the test suite lock; waiting for orchestrator at PID <pid> to finish...`  
  (Must convey that a different process became the active runner.)
- When **this process** successfully becomes orchestrator: print e.g.  
  `Lock acquired, running test suite as PID <pid>`  
  **before** any heavy work below.
- **Stale lock:** If record points to a **dead PID** or **fingerprint mismatch**, remove stale state under the exclusive lock and acquire—no unbounded wait on a zombie record. **Do not** `kill` a live orchestrator to clear the lock.

**Hold duration:** Keep the lock for the **entire** harness run (from post-acquisition through worker drain), **only** in the parent `run-tests.ts` process—not in per-case `deno test` subprocesses. Release in `finally`; handle SIGINT/SIGTERM where practical.

**Ordering after lock acquired:** **`ensureMemsearchOnPath()`**, **`discoverTestCases()`**, **`.giterloper*` deletion**, then workers—**all** must run **only after** this process is the recognized orchestrator (so no concurrent `.venv`/discovery/delete races from two harness parents).

**Bypass:** Direct `deno test tests/...` or `deno task test:cli` etc. do not use this lock; document.

Governing docs: tests/README.md (harness, isolation). **Portability:** document fingerprint/start-time behavior on non-Linux (fallback may rely on `kill(pid,0)` + lock lifetime—avoid silent wrong-owner assumptions).

## Acceptance Criteria

- Blocking lock at `run-tests.ts` entry with **stdout** messages above (or equivalent clarity); multi-waiter and stale-recovery behaviors covered.
- **Shared module:** export lock path, record format, parse, and liveness/fingerprint helpers from a small `scripts/` module **imported by** `run-tests.ts` and **git-ep51** scripts (single source of truth).
- Lock file **outside** `.giterloper`/`.giterloper_test`, **gitignored** at repo root if needed.
- **Regression:** **Strongly prefer** an automated test for “second invocation blocks until first completes” (e.g. env-gated self-test: parent holds lock/sleeps, child blocks then proceeds—**serialize** this test case in CI if cross-job interference is a risk). If genuinely infeasible without flaking, document **why** and keep a **mandatory** manual two-terminal checklist in tests/README.md (not optional fluff).
- Document message policy and blocking semantics in tests/README.md harness section; `./scripts/check_all.sh` passes.

