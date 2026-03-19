---
id: git-9b85
status: closed
deps: [git-951j]
links: []
created: 2026-03-18T21:27:02Z
type: task
priority: 1
assignee: user.email
parent: git-cj0u
---
# Align failing MCP tests to canonical _session contract

Resolve failing test coverage with the canonical contract as authority. Update/restore tests so they assert spec-defined behavior from docs/PIN_SETTING_PARAM_BEHAVIOR.md and docs/PIN_SET_CONTRACT.md: omitted pin -> session pin, explicit pin '_session' -> invalid_argument. Ensure tests do not encode behavior that contradicts the docs.

## Acceptance Criteria

1) tests/unit/mcp-insert-pending.test.ts coverage for omitted-pin behavior is enabled and stable. 2) tests/e2e/gl-mcp-workflow.test.ts passes without weakening the reserved-name contract. 3) Any test that previously contradicted the canonical docs is rewritten to match the docs (not vice versa).

