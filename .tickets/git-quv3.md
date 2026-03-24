---
id: git-quv3
status: open
deps: [git-zug8, git-8720]
links: []
created: 2026-03-24T16:00:09Z
type: task
priority: 1
assignee: user.email
parent: git-vsoz
---
# Decouple lib/ and scripts/ from specs/*.md in comments

Remove or rephrase **non-user-facing** JSDoc and file-header comments that cite `specs/mcp.md`, `specs/core.md`, `specs/pin-semantics.md` as generic 'see normative doc' pointers. **Out of scope:** user-visible help strings and MCP tool descriptions—those are **git-8720**. Use slice labels, state invariants locally, or point to AGENTS / specs hub. Narrow exception only where a comment traces a specific spec subsection and basename is essential. Includes scripts/bootstrap-memsearch.ts and gl-mcp-server-stdio.ts. Prefer sequential edit or careful merge with git-8720 on shared files (e.g. lib/cli.ts, lib/gl-mcp-server.ts).

## Acceptance Criteria

rg 'specs/[a-z0-9-]+\.md' lib/ scripts/ returns zero matches in **comments and JSDoc only**—verify manually that remaining hits are not string literals for user-facing surfaces (8720 owns those). deno check lib/gl.ts passes. Close note lists any narrow exceptions.

