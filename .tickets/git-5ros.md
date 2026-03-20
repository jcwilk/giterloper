---
id: git-5ros
status: open
deps: [git-tmna, git-mtl9, git-xgv2]
links: []
created: 2026-03-20T01:18:30Z
type: feature
priority: 1
assignee: user.email
parent: git-0i1b
---
# Per-case test modules + bounded worker pool runner

Implement generator under scripts/ that emits one Deno test module per logical case (from source definitions or exports). Implement bounded worker pool that schedules case modules with backfilling as workers finish (concurrency cap via DENO_JOBS or documented equivalent). Replace parallel-core/serial-integration split in run-tests.ts; update deno.json test tasks to match.

## Design

Deno 2.x does not parallelize multiple Deno.test in one file; one file per logical case is required for true per-test concurrency. See docs/TEST_PARALLELISM_PLAN.md diagram.

## Acceptance Criteria

deno task test runs one unified harness path. Pool backfills slots (not batch barrier). No documented serial exception for tests/cli vs tests/mcp. Evidence: ./scripts/check_all.sh green; AGENTS.md test bullet accurate.

