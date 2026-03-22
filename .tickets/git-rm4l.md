---
id: git-rm4l
status: open
deps: [git-incv]
links: []
created: 2026-03-22T00:21:49Z
type: feature
priority: 2
assignee: user.email
parent: git-zbfq
---
# Add human-driven spec-change subagent (spec + tickets commit, verifier gate)

New `.cursor/agents/*.md` subagent: **primary human entry point** for feeding specification changes to downstream agent work. **Assumes git-incv merged** (verifier understands plan-only commits).

**Flow:** (1) Apply requested edits under **`specs/*`** and/or **HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md** when in scope; these may remain **uncommitted** in the working tree while the next step runs. (2) Invoke **file-tickets** (per `.cursor/skills/file-tickets/SKILL.md` through its pre-commit review, including step 6) with **two** fused inputs: the **invoking conversation** (e.g. spec-change instructions from the human) **and** the **current uncommitted diff** for `specs/**` and the mandate file at repo root—treat that diff as normative context for what the new tickets must align (subagent prompts should summarize or cite it so review is grounded in the same delta). (3) **Single planning commit:** stage **every** uncommitted path under `specs/` and the mandate file that was part of that context **together with** all new or updated `.tickets/*.md` from the filing—**do not** commit tickets alone while leaving spec/mandate changes unstaged or in a separate commit. **Do not** mix implementation code or test changes into this commit. (4) **MUST** invoke verifier before finishing; acceptable outcomes include **APPROVED** when tickets plausibly cover spec intent **without** code in-repo (verifier semantics per **git-incv**). Note: spec-change is generally **human-invoked** (not work-next autopilot).

## Design

Mirror existing agent structure; reference `.cursor/skills/file-tickets/SKILL.md` and **HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md** by filename. Agent prose must state explicitly that **file-tickets** consumes **conversation + working-tree spec/mandate diffs** and that the **commit** includes both.

## Acceptance Criteria

Agent file exists; names **HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md** and `specs/*`; documents that **file-tickets** uses **uncommitted `specs/` + mandate** changes as filing context alongside the conversation; documents **one** planning commit containing those spec/mandate paths **and** the produced `.tickets/*.md`; verifier gate explicit with **plan-only** expectations aligned to **git-incv**; references file-tickets skill; aligns with user workflow (conversation ref **9ee956a8-4a31-47d2-8520-2d3f3b2e2ada**).
