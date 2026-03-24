---
id: git-fppc
status: open
deps: [git-zug8]
links: []
created: 2026-03-24T16:00:09Z
type: task
priority: 2
assignee: user.email
parent: git-vsoz
---
# Tests: canonical pairing in tests/README; trim per-file spec path noise

Keep tests/README.md pairing table concrete. Sweep **all** `tests/**/*.ts` (including `tests/helpers/`, `tests/core/`, `tests/mcp/`, `tests/pin-semantics/`, `tests/cli/`) for redundant `specs/<name>.md` in module JSDoc, comments, and string constants—prefer slice labels or pointers to tests/README pairing table per git-zug8. Document in close note any intentional exceptions (e.g. single const per file for provenance).

## Acceptance Criteria

tests/README.md pairing table unchanged in authority. `rg 'specs/[a-z0-9-]+\\.md' tests/` shows **zero** matches outside tests/README.md except exceptions listed in close note. If exceptions exist, each must justify why basename coupling is required.

