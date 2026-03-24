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
# Composed scripts: harness status, wait-then-stop policy

Add small composed scripts (shell and/or deno run scripts/) for operators and agents:

1) status/check: reports whether unified harness lock is held and whether PID is alive; exit 0 if no active harness, non-zero if active (or distinguish codes if useful).

2) wait-or-stop: **default path = wait only** up to a configurable duration (default 10 minutes), polling the lock record (**PID + fingerprint per git-ed8c**); exit 0 if the harness finishes or lock clears cleanly. If still active **after** the wait elapses, **stop the owning harness** using a **documented** strategy: prefer **process-group** termination (e.g. Linux `kill` to the same session/group as `run-tests.ts` children) so `deno test` workers and MCP grandchildren are more likely to reap; if only single-PID SIGTERM is implemented, **document limitations** and rely on **git-7qgy** follow-ups for orphan cleanup. SIGTERM first, optional SIGKILL after grace—**no extra `--force-kill` for post-timeout**. Killing **before** the wait elapses MUST require an explicit flag (e.g. `--force-kill-now`) or direct user instruction. Document that any kill may abort a run a human is watching.

These scripts **only** target the **git-ed8c** harness lock / owning PID—no broad `pkill deno`.

## Acceptance Criteria

- Two entrypoints from repo root; `--help` documents: default = wait; **post-timeout kill is allowed without an additional kill flag**; **early kill** requires explicit opt-in; **kill strategy** (process group vs single PID) documented with honest limits.
- Status script validates **PID + fingerprint** before reporting “active harness.”
- Referenced from tests/README.md (and AGENTS.md only if a single operational sentence is needed).
- Depends on **git-ed8c** lock file path and semantics.

