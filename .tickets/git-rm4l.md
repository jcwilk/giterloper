---
id: git-rm4l
status: closed
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

**Flow:** (1) Apply requested edits under **`specs/*`** (primary). Include **HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md** **only** when the human **explicitly** asked to change it in this session—**do not** treat root files as part of the default spec-change loop. Uncommitted edits may sit in the working tree while the next step runs. (2) Invoke **file-tickets** (per `.cursor/skills/file-tickets/SKILL.md` through its pre-commit review, including step 6) with fused inputs: the **conversation** **and** the **current uncommitted diff** for every path that will be bundled—**always** `specs/**`; **plus** the mandate file **if** (1) touched it. Subagent prompts should summarize or cite that diff. (3) **Single planning commit:** stage **all** uncommitted **`specs/`** paths that informed the filing **with** new/updated `.tickets/*.md`—**do not** commit tickets alone while leaving those specs unstaged. If the mandate was in scope per (1), stage it **in this same commit**; otherwise **no** root-file staging from this agent. **Do not** mix **lib/** implementation, **server** code, or **test** file changes into this commit. (4) **MUST** invoke verifier before finishing; acceptable outcomes include **APPROVED** when tickets plausibly cover spec intent **without** implementation in-repo (verifier semantics per **git-incv**). Spec-change is **human-invoked** (not work-next autopilot).

## Design

Mirror existing agent structure; reference `.cursor/skills/file-tickets/SKILL.md`. Name **HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md** only as an **optional** bundle target when the human requests mandate edits—**default** context is **conversation + `specs/` diff + tickets**. State clearly that **AGENTS.md**, root **README.md**, **CONVENTIONS.md**, and other **root instruction** files are **out of scope** for this subagent (human-managed).

## Acceptance Criteria

Agent file exists; centers on **`specs/*`** + **file-tickets** + planning commit with **`.tickets/*.md`**; documents **uncommitted `specs/`** diff as filing context; documents **optional** mandate inclusion when human-directed; documents **no** default workflow for other root instruction files; verifier gate aligned to **git-incv**; references file-tickets skill; consistent with **git-zbfq** process scope (conversation ref **9ee956a8-4a31-47d2-8520-2d3f3b2e2ada**).
