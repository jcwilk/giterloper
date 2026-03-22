---
id: git-ej14
status: closed
deps: [git-x31b]
links: []
created: 2026-03-22T06:18:04Z
type: task
priority: 1
assignee: user.email
parent: git-cvx0
---
# deno.json: load env file for MCP tasks (+ test-mode tasks)

Wire `deno.json` so **`mcp:serve`** and **`mcp:serve-stdio`** use **`--env-file=.env`** (matches git-x31b). Add **`mcp:serve:test`** and **`mcp:serve-stdio:test`** that use the same **`--env-file=.env`** plus **`--mcp-test-mode`** on the entrypoint so the server reads **`TEST_KNOWLEDGE_STORE_REMOTE`** and uses **`.giterloper_test`**. Prerequisite: contributor maintains a local **`.env`** (from **`.env.example`**) before tasks succeed—document in git-m4ln (missing `.env` / Deno `--env-file` failure is OK). Do not add dotenv parsing inside **`lib/gl-mcp-server*.ts`**. **AGENTS.md** alignment is git-m4ln; this ticket owns **`deno.json`** task strings. Document minimum Deno version for **`--env-file`** when tasks rely on it (git-m4ln may place the prose).

## Acceptance Criteria

`deno.json` task definitions include **`--env-file=.env`** for default MCP tasks; **`mcp:serve:test`** / **`mcp:serve-stdio:test`** append **`--mcp-test-mode`**; `./scripts/check_all.sh` green.

## Resolution

Closed 2026-03-21. **`deno.json`** tasks **`mcp:serve`**, **`mcp:serve-stdio`**, **`mcp:serve:test`**, **`mcp:serve-stdio:test`** as specified; suite green.

