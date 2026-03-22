---
id: git-m4ln
status: open
deps: [git-ej14]
links: []
created: 2026-03-22T06:18:05Z
type: chore
priority: 2
assignee: user.email
parent: git-cvx0
---
# Docs: AGENTS Cursor MCP + contributors use env files

Update **AGENTS.md** MCP sections (stdio serve, config). Frame as **operational only**: variable **semantics** stay in **specs/MCP.md**; AGENTS describes **how to supply** them locally (copy **`.env.example`** → **`.env`**, fill **`KNOWLEDGE_STORE_REMOTE`** and **`TEST_KNOWLEDGE_STORE_REMOTE`**; run **`deno task mcp:serve`** / **`mcp:serve-stdio`** for normal mode, or **`mcp:serve:test`** / **`mcp:serve-stdio:test`** for MCP test mode—the latter adds **`--mcp-test-mode`**, no env toggle). **Cursor:** the MCP server process does not load repo `.env` files automatically—duplicate the same **names** and **values** into **Cursor Settings → MCP** for the giterloper server (or OS/shell env). Brief note: Cursor Cloud / agent VMs may inject env differently than a local **`.env`**. Cross-link **tests/README.md** for integration authors. Do not contradict **specs/MCP.md**. If **git-ej14** documents a minimum Deno version for **`--env-file`**, include it where toolchain is described.

## Acceptance Criteria

AGENTS.md includes the above workflow, required variable **names** (defer semantics to specs/MCP.md), and Cursor MCP placement guidance; no normative contract drift; `./scripts/check_all.sh` remains green (it does not lint markdown today—doc-only changes are fine as long as the script still passes).
