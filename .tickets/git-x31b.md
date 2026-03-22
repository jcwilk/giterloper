---
id: git-x31b
status: open
deps: []
links: []
created: 2026-03-22T06:18:03Z
type: task
priority: 1
assignee: user.email
parent: git-cvx0
---
# Env files: templates, gitignore, naming convention

Define repo convention for local-only env files used when running MCP entrypoints (stdio/HTTP) from the workspace. Deliver: (1) committed template(s), canonical name **`.env.mcp.example`** (add **`.env.mcp.test.example`** only if a second profile is split in templates), documenting KNOWLEDGE_STORE_REMOTE for normal mode and optional GITERLOPER_MCP_TEST_MODE + TEST_KNOWLEDGE_STORE_REMOTE for harness-style local runs. Normative names/semantics for knowledge-store vars and MCP_TOKEN: **specs/MCP.md**. Optional local hints (MCP_INSECURE, GITERLOPER_GH_TOKEN, MCP_PORT, MCP_HOST) may appear as commented pointers to **AGENTS.md** / ops docs—do not imply they are normative in MCP.md. (2) Extend **root** `.gitignore` for local files (e.g. `.env.mcp.local`, `.env.mcp.test.local`). **Do not** add a blanket `.env.*` ignore without an exception for committed `*.example` files (narrow patterns or `!` negation—`.dockerignore` already uses `.env.*` but gitignore must not hide tracked templates). (3) Short design note in commit or ticket close: default file for day-to-day MCP vs optional test-mode profile. **Which file `deno task` loads is git-ej14** (this ticket only names paths and templates).

## Acceptance Criteria

Root `.gitignore` ignores agreed local env filenames; committed **`.env.mcp.example`** (and optional second template if used) with placeholders and comments; no secrets; scope is this ticket title plus description and acceptance above.

