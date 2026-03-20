---
id: git-alnk
status: closed
deps: []
links: []
created: 2026-03-20T03:24:39Z
type: task
priority: 1
assignee: user.email
parent: git-lqvd
---
# Raise default DENO_JOBS to 16 in harness and docs

Change scripts/run-tests.ts workerCount() fallback from 8 to 16 and update the file header comment. Align AGENTS.md, tests/README.md, and docs/TEST_PARALLELISM_PLAN.md anywhere they state the default worker count as 8.

## Acceptance Criteria

Default when DENO_JOBS is unset is 16 concurrent workers; grep for default 8 in harness/docs is resolved or intentionally updated; deno check lib/gl.ts passes; ./scripts/check_all.sh green once on branch with only this change (or verifier-equivalent).

