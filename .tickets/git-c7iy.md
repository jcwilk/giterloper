---
id: git-c7iy
status: closed
deps: [git-5l01]
links: []
created: 2026-03-16T00:22:11Z
type: feature
priority: 1
assignee: user.email
parent: git-6wkq
---
# Refactor MCP tools for default-pin semantics

Update MCP tool schemas and handlers to make pin args optional where meaningful, apply reconcile side-defaulting rules, add/adjust giterloper_pin_set, enforce shared reserved-name validation, and include session/pin metadata in responses.

## Acceptance Criteria

Search/retrieve/insert/reconcile_pending allow omitted pin via session default; reconcile defaults omitted side when one side is explicit; explicit default pin name is rejected with corrective guidance everywhere.

