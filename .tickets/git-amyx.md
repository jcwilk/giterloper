---
id: git-amyx
status: open
deps: []
links: []
created: 2026-03-22T02:43:27Z
type: epic
priority: 2
assignee: user.email
---
# Epic: MCP mandatory KNOWLEDGE_STORE_REMOTE, server-defined repo, always _session

Implement specs/MCP.md and specs/core.md Pin configuration semantics updates: KNOWLEDGE_STORE_REMOTE required at MCP server startup; no client source on MCP tools; every active MCP session must have _session bootstrapped from the configured remote before tool handlers run. Canonical: specs/MCP.md (Knowledge store configuration, Session pin bootstrap), specs/core.md (Surfaces table, Session pin existence and bootstrap, missing_pin row).

