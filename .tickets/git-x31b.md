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

Define repo convention for local-only env files used when running MCP entrypoints (stdio/HTTP) from the workspace. Use **one committed template** **`.env.example`** (documents normal mode, test mode, and optional hints in sections/comments). Contributors copy it to gitignored **`.env.dev`** (day-to-day) and/or **`.env.test`** (trim or enable the test-mode vars per comments)—not ad-hoc `.env.mcp.*` names. Normative names/semantics for knowledge-store vars and MCP_TOKEN: **specs/MCP.md**. Optional local hints (MCP_INSECURE, GITERLOPER_GH_TOKEN, MCP_PORT, MCP_HOST) may appear as commented pointers to **AGENTS.md** / ops docs—do not imply they are normative in MCP.md. (2) Extend **root** `.gitignore` for **`.env.dev`** and **`.env.test`** only. **Do not** add a blanket `.env.*` ignore without an exception for **`.env.example`** (narrow patterns or `!` negation—`.dockerignore` already uses `.env.*` but gitignore must not hide the committed template). (3) Short design note in commit or ticket close: `.env.dev` = default local MCP; `.env.test` = MCP test-mode profile. **Which file `deno task` loads is git-ej14** (this ticket only names paths and templates).

## Acceptance Criteria

Root `.gitignore` ignores **`.env.dev`** and **`.env.test`**; committed **`.env.example`** with placeholders and comments; no secrets; scope is this ticket title plus description and acceptance above.
