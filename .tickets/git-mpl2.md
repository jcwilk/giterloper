---
id: git-mpl2
status: open
deps: [git-9btr, git-6g05]
links: []
created: 2026-03-22T00:21:44Z
type: task
priority: 2
assignee: user.email
parent: git-zbfq
---
# Update root README.md for hierarchical truth entrypoint

**Scope:** **One-time** epic update. Root **README.md** is **not** part of the recurring **tickets/specs/tests/code** process; later edits are **human-managed** only (**git-zbfq**).

**Depends on git-9btr** (mandate exists) and **git-6g05** (root MCP.md demoted; **specs/MCP.md** canonical) so MCP entry points in README are correct in one pass.

Brief orientation for **human** contributors: where to find **specs/**, **tests**, and implementation (this file is root onboarding, not agent law). **Defer** full agent workflow and “read these root laws” **nudges** to **AGENTS.md** (**git-36ls**)—README should **not** paraphrase the precedence stack or duplicate mandate content; **at most** one line pointing humans/agents to **AGENTS.md** for agent rules. **MCP:** point readers at **`specs/MCP.md`** (or agreed stub)—**git-6g05** is primary owner of reference migration; coordinate if both touch the same line. **Pin:** generic “canonical spec under `specs/`” unless **git-46zo** named the file.

## Acceptance Criteria

README.md orients to `specs/` + tests + code without duplicating universal-law prose; **agent** nudges live in **AGENTS.md** (not re-listed here beyond a single pointer if needed); MCP pointer matches post-**git-6g05** layout; explicit README change is in-scope for this ticket (not drive-by).

