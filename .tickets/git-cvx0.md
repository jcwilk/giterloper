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

Establish a convenient, standard way for contributors and Cursor stdio MCP to supply mandatory MCP env (KNOWLEDGE_STORE_REMOTE or GITERLOPER_MCP_TEST_MODE + TEST_KNOWLEDGE_STORE_REMOTE) without ad-hoc shell exports. Use **one committed** **`.env.example`** and **gitignored** **`.env.dev`** / **`.env.test`** (dev vs test profiles; copy from the same template). Cursor’s stdio MCP config does not automatically load repo `.env` files; contributors still copy variable names/values into Cursor MCP settings or OS env (see git-m4ln). Normative MCP env semantics remain specs/MCP.md and specs/core.md; this epic is tooling/docs only unless a minimal code seam is required. Deno supports loading env from a file via CLI (e.g. deno run --env-file=...); prefer native flags over new runtime dotenv in lib/.

## Acceptance Criteria (epic)

Epic complete when child tickets git-x31b, git-ej14, and git-m4ln are closed and `./scripts/check_all.sh` remains green for the batch.
