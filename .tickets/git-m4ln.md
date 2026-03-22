---
id: git-m4ln
status: closed
deps: [git-ej14]
links: []
created: 2026-03-22T06:18:05Z
type: chore
priority: 2
assignee: user.email
parent: git-cvx0
---
# Docs: AGENTS Cursor MCP + contributors use env files

**AGENTS.md** MCP section (run environment bullet + **### MCP server**): operational only—semantics in **specs/MCP.md**; local **`.env.example` → `.env`**, **`deno task mcp:serve`** / **`mcp:serve-stdio`** vs **`:test`** tasks (**`--mcp-test-mode`**), raw **`deno run`** vs **`--env-file`**, Cursor stdio env duplication, **`--env-file`** Deno requirement note, and **Config** paragraph aligned with current behavior. **tests/README.md** remains canonical for integration harness details.

## Acceptance Criteria

AGENTS.md includes the above workflow, required variable **names** (defer semantics to specs/MCP.md), and Cursor MCP placement guidance; no normative contract drift; `./scripts/check_all.sh` remains green (it does not lint markdown today—doc-only changes are fine as long as the script still passes).

## Resolution

Closed 2026-03-21. **AGENTS.md** updated (run-environment MCP one-liner + expanded **### MCP server**: `.env` workflow, tasks, test tasks, Cursor, config cross-links).
