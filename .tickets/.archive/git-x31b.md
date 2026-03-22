---
id: git-x31b
status: closed
deps: []
links: []
created: 2026-03-22T06:18:03Z
type: task
priority: 1
assignee: user.email
parent: git-cvx0
---
# Env files: templates, gitignore, naming convention

Define repo convention for local env used when running MCP entrypoints (stdio/HTTP) from the workspace. Use **one gitignored** **`.env`** (not checked in) populated from committed **`.env.example`**. **`.env.example`** lists only the two knowledge-store keys (**`KNOWLEDGE_STORE_REMOTE`**, **`TEST_KNOWLEDGE_STORE_REMOTE`**) with empty values—no toggle env vars; MCP **test mode** is selected with the **`--mcp-test-mode`** CLI flag (see **specs/MCP.md**), not an environment variable. Normative semantics for those remotes: **specs/MCP.md**. Other operator vars (`MCP_TOKEN`, `MCP_INSECURE`, etc.) stay documented in **AGENTS.md** / ops docs only. (2) Root **`.gitignore`** must ignore **`.env`** without a blanket `.env.*` that hides **`.env.example`**. (3) **`deno task`** wiring for `--env-file` is **git-ej14**.

## Acceptance Criteria

Root `.gitignore` ignores **`.env`**; committed **`.env.example`** contains exactly the two knowledge remote keys (empty values); no secrets in repo; scope is this ticket title plus description and acceptance above.

## Resolution

Closed 2026-03-21. **`.env.example`** and **`.gitignore`** (`.env`) match acceptance; **`--mcp-test-mode`** / no **`GITERLOPER_MCP_TEST_MODE`** documented in **specs/MCP.md**.
