---
id: git-ep51
status: open
deps: [git-ed8c]
links: []
created: 2026-03-24T03:39:47Z
type: task
priority: 1
assignee: user.email
parent: git-05a6
---
# Composed scripts: harness status and optional wait-for-idle (no kill-after-timeout)

**git-ed8c** makes `run-tests.ts` **block** until the orchestrator slot is free, with user-visible stdout—agents invoking `deno task test` / `check_all` normally need **no** separate wait script.

Add small **composed** scripts (shell and/or `deno run scripts/...`; optional **`deno.json` tasks** with stable names—document from repo root) for edge cases (CI probes, humans checking state without running tests). **Parsing rules** for active/stale/idle **must match git-ed8c**—implementation should **export a single shared module** (lock path, record parse/format, liveness+fingerprint checks) **imported by both** `run-tests.ts` and these scripts so parsers cannot drift.

1) **status / check:** Read the **git-ed8c** lock record; report whether an orchestrator is **active** (PID alive + fingerprint match); useful exit codes (e.g. 0 = idle, 1 = active, 2 = stale record—tune and document). **STDOUT** should show PID and short reason.

2) **optional wait-for-idle:** For tooling that **cannot** call `run-tests.ts` but must pause until the harness is idle: poll the same lock contract and block with **occasional stdout** (similar tone to git-ed8c). **Must not** kill the active orchestrator. **No** default **timeout-then-kill** behavior anywhere in this ticket—queued agents rely on the active run finishing naturally.

**Explicitly out of scope for git-ep51:** Kill-after-timeout, “make room” SIGTERM/SIGKILL of the harness, or process-group slaughter of waiters’ peers. If an **emergency** human-only kill path is ever desired, it must be a **separate** ticket with strong warnings—not bundled here.

Scripts target only the **git-ed8c** lock contract—no broad `pkill deno`.

## Acceptance Criteria

- At least **harness-status** (name adjustable) shipped and documented from repo root; **wait-for-idle** optional if justified in ticket closure note.
- `--help` states **no kill / no timeout-kill**; references tests/README.md.
- Depends on **git-ed8c** lock path and record format.

