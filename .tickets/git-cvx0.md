---
id: git-cvx0
status: open
deps: []
links: []
created: 2026-03-22T06:18:00Z
type: epic
priority: 2
assignee: user.email
---
# Epic: repo-local .env files for Deno/MCP (KNOWLEDGE_STORE_REMOTE etc.)

Establish a convenient way for contributors and Cursor stdio MCP to supply **`KNOWLEDGE_STORE_REMOTE`** and **`TEST_KNOWLEDGE_STORE_REMOTE`** (same **`.env`** file; test mode uses the test remote only when the process is started with **`--mcp-test-mode`** per **specs/MCP.md**). **`.env.example`** is the committed template; **`.env`** is local-only. Cursor’s stdio MCP config does not load repo `.env` automatically; contributors copy names/values into Cursor MCP settings or OS env (see git-m4ln). Normative MCP semantics remain **specs/MCP.md** and **specs/core.md**; this epic is tooling/docs plus the **`--mcp-test-mode`** / **`--env-file`** seams already in tree. Deno loads env via CLI **`--env-file`** at the process boundary only.

## Acceptance Criteria (epic)

Epic complete when child tickets git-x31b, git-ej14, and git-m4ln are closed and `./scripts/check_all.sh` remains green for the batch.

