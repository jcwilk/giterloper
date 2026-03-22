---
id: git-36ls
status: open
deps: [git-9btr, git-46zo]
links: []
created: 2026-03-22T00:21:44Z
type: task
priority: 2
assignee: user.email
parent: git-zbfq
---
# Update AGENTS.md for mandate, orthogonality, and new paths

**Scope:** **One-time** epic alignment of **AGENTS.md** with the new hierarchy. **Do not** imply agents should run **file-tickets**, spec-change, or similar machinery for routine **AGENTS.md** updates—those remain **rare**, **human-directed**, and **outside** the tickets/specs/tests/code workflow (**git-zbfq**).

**Depends on git-9btr** (mandate file + minimal prominent link) and **git-46zo** (canonical pin path + doc trims). **Transitive:** **git-46zo** requires **git-6g05**, so **specs/MCP.md** and root MCP demotion land before this closes—AGENTS must point MCP readers at **specs/MCP.md**, not normative root MCP.md.

Revise AGENTS.md: **preserve and integrate** the prominent mandate link from **git-9btr** (this is the consolidating pass, not a second mandate rollout). **This file is the only agent-facing place** that should **nudge** reading other **root** instruction/onboarding docs and the mandate. Epic “only AGENTS nudges” applies to **root** paths—**AGENTS remains the canonical place to name and link `specs/*`, tests README, and verifier** for agent workflows. **specs/**, **tests/README**, **verifier**, and **lib** must not pepper “see AGENTS/mandate” hooks; they assume universal law (**git-zbfq**). State orthogonal relationship between root instruction files and `specs/*`; product-truth precedence **within a slice** (`specs/*` > tests > code); **docs/** demotion; use hierarchical alignment / hierarchical divergence vocabulary; instruct agents that **judgement** (vs past precedence) governs materially new behavior needing spec updates—no numeric metric. Replace pointers to `docs/PIN_SETTING_PARAM_BEHAVIOR.md` and similar with the **single** canonical specs path from **git-46zo**. Clarify spec edits are **task-scoped** only.

**Reconcile tier-(1) “normative contracts”:** Current AGENTS lists markdown specs, CLI help, and MCP tool descriptions as authoritative—align this with the mandate in **AGENTS/mandate prose** so **`specs/cli.md` / `specs/MCP.md`** relate clearly to **CLI help** and **tool descriptions** (e.g. intentional sync, conflict = bug to fix in lockstep—no silent pick). **Do not** require those slice specs to cite AGENTS or restate the full repo-wide stack. This ticket updates **agent guidance**, not product specs without user direction (existing AGENTS rule).

## Acceptance Criteria

AGENTS.md consistent with HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md; mandate link prominent; references point to `specs/*` (including **specs/MCP.md**); no stale pin-doc or deprecated-doc paths; precedence section reconciles slice specs with CLI help / MCP strings per description; **git-9btr** link work integrated, not duplicated or removed.

