---
id: git-c5i1
status: closed
deps: []
links: []
created: 2026-03-15T22:01:44Z
type: chore
priority: 2
assignee: user.email
parent: git-0fof
---
# Remove all references to retrieve id

Remove the id parameter from giterloper_retrieve: schema, handler validation, docs (MCP.md, MCP_API_CONTRACT.md), and reference client types/tests. Id is not used anywhere and retrieval is path-only.

