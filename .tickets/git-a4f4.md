---
id: git-a4f4
status: closed
deps: [git-jkpb]
links: []
created: 2026-03-22T02:43:33Z
type: task
priority: 0
assignee: user.email
parent: git-amyx
---
# MCP: fail fast at startup when required knowledge remote missing (per mode)

Normative: specs/MCP.md § Knowledge store configuration — after **`git-t6y7`**, startup validation MUST use the **effective** env var for the active **`mcpTestMode`** (**`KNOWLEDGE_STORE_REMOTE`** vs **`TEST_KNOWLEDGE_STORE_REMOTE`**). Unset/empty/invalid for that mode → immediate non-zero exit, stderr message; no listen, no lazy first-tool failure.

## Design

**After `git-t6y7`:** verify stdio + HTTP + shared **`createServer`** paths enforce the dual-env startup contract end-to-end; extend to **Docker / `run-docker` / any alternate MCP entrypoint** not covered by **`git-nyh6`**. Reuse the same validation helper; invalid remote forms fail the same way in both modes.

## Acceptance Criteria

**Non–test mode:** **`KNOWLEDGE_STORE_REMOTE` unset, empty, or invalid** → non-zero exit before serving. **MCP test mode:** same for **`TEST_KNOWLEDGE_STORE_REMOTE`**. With the correct env set for the mode, server starts. Operator-facing doc updates are tracked in **`git-nh06`** (not in-scope for closing this ticket).

