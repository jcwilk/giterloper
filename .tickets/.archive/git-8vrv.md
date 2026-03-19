---
id: git-8vrv
status: closed
deps: [git-izvk]
links: []
created: 2026-03-17T08:31:19Z
type: feature
priority: 1
assignee: user.email
parent: git-6elj
---
# Implement MCP giterloper_pin_set to canonical semantics

Update MCP tool descriptor and server implementation so giterloper_pin_set behavior matches the chosen canonical contract. Enforce argument validation (reject unknown/unsupported fields), implement required pin-name semantics, and ensure returned codes/messages are stable and actionable.

## Acceptance Criteria

Tool descriptor arguments match runtime behavior; invalid arg combinations fail deterministically; _session and omitted-pin behavior follows canonical contract; smoke check via MCP tool call passes expected scenarios

