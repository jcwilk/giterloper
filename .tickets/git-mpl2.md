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

Brief orientation: read **HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md**, then applicable `specs/*` for the area you touch; tests enforce; implementation follows. Link mandate. **MCP:** point readers at **`specs/MCP.md`** (or agreed stub)—**git-6g05** is primary owner of reference migration; avoid contradicting that ticket’s README edits (coordinate in one merge if both touch the same line). Avoid duplicating long AGENTS precedence text. **Pin:** use **generic** “see canonical spec under specs/” unless **git-46zo** has named the pin file—do not guess paths before **git-46zo** if adding pin links (optional to omit concrete pin path here).

## Acceptance Criteria

README.md links mandate and `specs/` model; MCP pointer matches post-**git-6g05** layout; no contradiction with AGENTS; explicit README change is in-scope for this ticket (not drive-by).

