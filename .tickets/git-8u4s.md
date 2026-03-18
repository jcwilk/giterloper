---
id: git-8u4s
status: open
deps: [git-951j, git-9b85]
links: []
created: 2026-03-18T21:27:06Z
type: task
priority: 1
assignee: user.email
parent: git-cj0u
---
# Prove full check_all pass under canonical pin contract

After implementation and test-alignment fixes, verify the entire canonical check sequence passes via ./scripts/check_all.sh and retain evidence in ticket context. Validation must not alter docs-defined pin semantics.

## Acceptance Criteria

1) ./scripts/check_all.sh exits 0. 2) Evidence includes typecheck, unit, and E2E passing in canonical order. 3) Reserved-name behavior remains enforced: explicit pin '_session' fails, omitted pin paths succeed where expected.

