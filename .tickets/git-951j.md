---
id: git-951j
status: open
deps: []
links: []
created: 2026-03-18T21:26:56Z
type: bug
priority: 1
assignee: user.email
parent: git-cj0u
---
# Fix internal session-pin SHA updates without API contract drift

Fix the deterministic write-path failure causing reserved-name errors during session-pin insert/reconcile while preserving the canonical API contract. Anchor behavior to docs/PIN_SETTING_PARAM_BEHAVIOR.md and docs/PIN_SET_CONTRACT.md: explicit pin '_session' must always fail for user/API pin-name inputs; omitted pin targets session pin. Internal lifecycle code (non-user-input paths) must be able to advance the session pin SHA safely.

## Acceptance Criteria

1) MCP insert_pending/reconcile_pending with omitted pin succeeds on session pin and advances SHA as expected. 2) Explicit API input pin: '_session' still fails with invalid_argument and corrective guidance. 3) Add/adjust unit coverage that separates API input validation from internal lifecycle/session-pin maintenance paths.

