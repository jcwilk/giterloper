---
id: git-nh06
status: open
deps: [git-a4f4, git-6lq1]
links: []
created: 2026-03-22T02:43:33Z
type: chore
priority: 3
assignee: user.email
parent: git-amyx
---
# docs: operator notes for mandatory KNOWLEDGE_STORE_REMOTE and MCP bootstrap

docs/ MUST NOT contradict specs/MCP.md (AGENTS deployment notes if they describe MCP env). Update Fly/docker/local run docs so operators set KNOWLEDGE_STORE_REMOTE before MCP serve.

## Acceptance Criteria

- Docs state **`KNOWLEDGE_STORE_REMOTE`** is **required** for the MCP server; no wording that it is optional for MCP.
- Docs briefly describe that new MCP sessions **bootstrap `_session`** from that remote (default branch HEAD), consistent with **`specs/MCP.md`** — implement after **`git-6lq1`** lands so examples match behavior.

