---
id: git-vknr
status: closed
deps: []
links: []
created: 2026-03-22T02:18:25Z
type: chore
priority: 2
assignee: user.email
---
# Planning: remove root MCP.md and USE_CASES.md; add specs/use-cases.md

Human-directed spec-change (spec-change agent). Fold former root USE_CASES narrative into specs as descriptive product context. Remove root MCP stub; normative MCP contract is only specs/MCP.md. Update AGENTS.md and README onboarding links; specs/MCP.md links to use-cases for motivation.

## Acceptance Criteria

- Root `MCP.md` and `USE_CASES.md` deleted.
- `specs/use-cases.md` exists with descriptive (non-normative) architecture and two use cases; defers pins/tools to `specs/core.md` and `specs/MCP.md`.
- `specs/MCP.md` links to `use-cases.md` for context.
- `AGENTS.md` docs/ layering bullet no longer references root `MCP.md`; points to `specs/MCP.md` only.
- `README.md` mentions `specs/use-cases.md`; no in-repo markdown links to deleted root `MCP.md`.
- No `lib/` or `tests/` changes in this commit.

