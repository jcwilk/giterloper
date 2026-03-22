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

New .cursor/agents/*.md subagent: primary human entry point for feeding specification changes to downstream agent work. Flow: (1) Apply requested edits to specs/* and/or HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md when in scope. (2) Run file-tickets skill to create however many tickets are needed for code+test hierarchical alignment—do NOT mix code/test changes into this commit; plans-only commits stay separate from implementation commits per current workflow. (3) Single commit containing spec/mandate edits AND new .tickets/*.md together to show joint planning intent. (4) MUST invoke verifier before finishing; verifier evaluates whether tickets adequately capture spec deltas (without requiring explicit delta mapping in ticket bodies). Note: spec-change is generally human-invoked (not work-next autopilot).

## Design

Mirror existing agent structure; reference .cursor/skills/file-tickets/SKILL.md and the mandate file.

## Acceptance Criteria

Agent file exists; documents commit boundaries (spec+tickets only); verifier gate explicit; aligns with user workflow answers.

