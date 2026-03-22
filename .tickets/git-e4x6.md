---
id: git-e4x6
status: open
deps: [git-9btr]
links: []
created: 2026-03-22T00:21:38Z
type: task
priority: 1
assignee: user.email
parent: git-zbfq
---
# Author specs/core.md (strict coverage vs tests/core)

Add specs/core.md: same constraints as **git-6uc2** (~2 pages, no global process rules, no spec changelog, **no** root-instruction filename citations) for **tests/core/\*.test.ts** and shared library semantics (paths, git orchestration, retries, memsearch boundaries, reconcile/add-queue, pin **surfaces** as exercised by core tests, etc.). **Strict coverage** means every **theme** asserted under tests/core maps to checkable statements in specs/core.md (not 1:1 with test file names). **Full normative merge** of `docs/PIN_SETTING_PARAM_BEHAVIOR.md` / `docs/PIN_SET_CONTRACT.md` is **git-46zo**—include pin-related content here only **as required** by tests/core and to stay non-contradictory with sibling specs until 46zo chooses the single canonical spec file; label interim pin paragraphs if needed. Minimize overlap with specs/MCP.md and specs/cli.md; where overlap exists it must be consistent.

## Acceptance Criteria

specs/core.md exists; strict coverage vs **tests/core** themes; length ~2 pages target; consistent with sibling specs; **no** references by filename to root instruction/onboarding docs; does not preempt **git-46zo** pin merge (no duplicate canonical pin doc paste).

