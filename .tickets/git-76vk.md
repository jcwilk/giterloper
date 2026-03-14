---
id: git-76vk
status: open
deps: [git-dadj, git-6ens]
links: []
created: 2026-03-14T19:02:49Z
type: task
priority: 1
assignee: user.email
parent: git-mowe
---
# Add isolation tests for per-version memsearch indexes

Create focused tests that prove indexes are isolated per pin+sha and stale-index metadata cannot be queried accidentally.

## Design

Construct scenarios with same pin across different SHAs and verify index namespace separation, mismatch failures, and no cross-version retrieval leakage.

## Acceptance Criteria

- Tests explicitly assert no cross-sha index reuse.
- Metadata mismatch produces fail-closed behavior.
- Build-on-demand path is tested and bound to requested pin+sha.
- Regression tests guard against accidental fallback logic.
