---
id: git-cvx0
status: closed
deps: []
links: []
created: 2026-03-22T06:18:00Z
type: epic
priority: 2
assignee: user.email
---
# Epic: repo-local .env files for Deno/MCP (KNOWLEDGE_STORE_REMOTE etc.)

Establish a convenient way for contributors and Cursor stdio MCP to supply **`KNOWLEDGE_STORE_REMOTE`** and **`TEST_KNOWLEDGE_STORE_REMOTE`** (same **`.env`** file; test mode uses the test remote only when the process is started with **`--mcp-test-mode`** per **specs/MCP.md**). **`.env.example`** is the committed template; **`.env`** is local-only. Cursor’s stdio MCP config does not load repo `.env` automatically; contributors copy names/values into Cursor MCP settings or OS env (**AGENTS.md** MCP section). Normative MCP semantics remain **specs/MCP.md** and **specs/core.md**; **`--mcp-test-mode`** and **`--env-file`** are implemented at the process boundary only.

## Acceptance Criteria (epic)

Epic complete when child tickets git-x31b, git-ej14, and git-m4ln are closed and `./scripts/check_all.sh` remains green for the batch.

## Resolution

Closed 2026-03-21. Delivered: **`.env.example`** / **`.gitignore` → `.env`**, **`deno.json`** `mcp:*` tasks with **`--env-file=.env`** and **`:test`** variants with **`--mcp-test-mode`**, **AGENTS.md** run/config/Cursor guidance, specs and **tests/README** aligned with flag-based test mode; **`./scripts/check_all.sh`** green at close.

