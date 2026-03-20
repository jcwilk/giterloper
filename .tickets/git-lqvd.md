---
id: git-lqvd
status: open
deps: []
links: []
created: 2026-03-20T03:24:36Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Single-knob harness concurrency and stress validation

Unify test subprocess scheduling on DENO_JOBS only (default 16), remove GITERLOPER_REMOTE_TEST_CONCURRENCY, and validate with many consecutive green ./scripts/check_all.sh runs. Runner contract remains in tests/README.md and docs/TEST_PARALLELISM_PLAN.md (update both to match implementation).

