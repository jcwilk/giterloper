---
id: git-4nsv
status: open
deps: [git-cfer, git-vraz]
links: []
created: 2026-03-16T20:41:56Z
type: chore
priority: 2
assignee: user.email
parent: git-jwl2
---
# Document dual-transport contract

Update server/docs references to describe stdio and HTTP/SSE operation, with an explicit parity contract that defines what must stay identical across transports and what is intentionally transport-specific.

## Acceptance Criteria

- Run instructions include both transports\n- Parity contract clearly states shared vs transport-specific behavior\n- Docs remain consistent across MCP.md, AGENTS.md, and reference client guidance

