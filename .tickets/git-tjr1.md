---
id: git-tjr1
status: closed
deps: [git-5ros]
links: []
created: 2026-03-20T01:18:31Z
type: task
priority: 2
assignee: user.email
parent: git-0i1b
---
# Migrate full suite to per-case harness and verify definition of done

Migrate tests/core, tests/cli, tests/mcp (and reference_client if applicable) so every logical case is reachable as a generated module under the new runner. Remove interim dual-runner behavior. Final pass: ensure no _cli fallback in tests for isolation, no env mutation in tests, docs/TEST_PARALLELISM_PLAN.md definition of done satisfied.

## Acceptance Criteria

./scripts/check_all.sh passes. DENO_JOBS respected for pool. tests/README.md + AGENTS.md match actual runner (spot-check). Optional: deno task test:core|cli|mcp remain useful but consistent with isolation rules.

