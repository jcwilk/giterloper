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

2) wait-or-stop: **default path = wait only** up to a configurable duration (default 10 minutes), polling the lock/PID; exit 0 if the harness finishes. If still active **after** the wait elapses, **kill the owning harness process tree** (SIGTERM, then optional SIGKILL after a short grace) and clear stale lock—**no extra `--force-kill` is required for this post-timeout path** (that is the intended default completion when the harness never exits). Killing **before** the wait elapses MUST require an explicit flag (e.g. `--force-kill-now`) or direct user instruction—agents must not jump straight to early kill. Document that any kill may abort a run a human is watching.

These scripts **only** target the **git-ed8c** harness lock / owning PID—no broad `pkill deno`.

## Acceptance Criteria

- Two entrypoints from repo root; `--help` documents: default = wait; **post-timeout kill is allowed without an additional kill flag**; **early kill** requires explicit opt-in.
- Referenced from tests/README.md (and AGENTS.md only if a single operational sentence is needed).
- Depends on **git-ed8c** lock file path and semantics.

