---
id: git-lpj8
status: open
deps: []
links: []
created: 2026-03-18T21:18:50Z
type: bug
priority: 1
assignee: user.email
parent: git-0sqi
---
# Fix internal _session update path in pin lifecycle

Fix internal write/update paths so session pin (_session) can be updated by internal code without triggering user-input reserved-name validation. In particular, updatePinSha currently validates pinName and may reject _session during MCP write flows (insert/reconcile) that advance session pin SHA.

## Acceptance Criteria

1) MCP insert/reconcile flows that omit pin can advance the session pin SHA without reserved-name errors. 2) Explicit user-supplied pin: '_session' in pin-name-bearing API inputs remains rejected with corrective guidance. 3) Add/adjust unit coverage for lifecycle update behavior involving _session (internal path) versus user input validation path.

