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

New .cursor/agents/*.md subagent: **primary human entry point** for feeding specification changes to downstream agent work. **Assumes git-incv merged** (verifier understands plan-only commits). Flow: (1) Apply requested edits to `specs/*` and/or **HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md** when in scope. (2) Run **file-tickets** per `.cursor/skills/file-tickets/SKILL.md` through **step 6** (pre-commit subagent review + parent reconciliation); for **step 7** use the skill’s **bundled planning commit** path so tickets are **not** committed alone—**do NOT** mix code/test changes into this commit; implementation stays separate commits. (3) Single commit: spec/mandate edits **and** new/updated `.tickets/*.md` only. (4) **MUST** invoke verifier before finishing; acceptable outcomes include **APPROVED** when tickets plausibly cover spec intent **without** code in-repo (verifier semantics per **git-incv**—do not require implementation proof for this commit shape). Note: spec-change is generally **human-invoked** (not work-next autopilot).

## Design

Mirror existing agent structure; reference `.cursor/skills/file-tickets/SKILL.md` and **HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md** by filename.

## Acceptance Criteria

Agent file exists; names **HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md** and `specs/*`; documents commit boundaries (spec+tickets only); verifier gate explicit with **plan-only** expectations aligned to **git-incv**; references file-tickets skill; aligns with user workflow (conversation ref **9ee956a8-4a31-47d2-8520-2d3f3b2e2ada**).

