---
id: git-uor7
status: open
deps: [git-zug8, git-1dih]
links: []
created: 2026-03-24T16:00:09Z
type: task
priority: 2
assignee: user.email
parent: git-vsoz
---
# Decouple docs/ and operational cross-links to normative specs

docs/DEPLOYMENT_REQUIREMENTS.md, docs/FLY_IO_DEPLOYMENT.md: reduce repeated inline specs/mcp.md links; one clear layering pointer to MCP slice (hub or AGENTS). Preserve operational accuracy.

## Acceptance Criteria

Docs remain mandate-aligned (operational only). No stale paths; normative pointers use hub or slice language per policy ticket.

