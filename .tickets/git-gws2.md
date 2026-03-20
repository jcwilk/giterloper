---
id: git-gws2
status: open
deps: [git-alnk]
links: []
created: 2026-03-20T03:24:41Z
type: task
priority: 1
assignee: user.email
parent: git-lqvd
---
# Remove GITERLOPER_REMOTE_TEST_CONCURRENCY; schedule CLI/MCP on worker pool only

Delete the remote-integration semaphore path in scripts/run-tests.ts: remove isRemoteIntegrationCase, remoteIntegrationConcurrency, Semaphore usage for CLI/MCP, and GITERLOPER_REMOTE_TEST_CONCURRENCY env handling. All manifest cases use the same worker pool capped only by DENO_JOBS. Remove the env var and behavior descriptions from tests/README.md, AGENTS.md, docs/TEST_PARALLELISM_PLAN.md; grep the repo for GITERLOPER_REMOTE_TEST_CONCURRENCY and clean stale references (excluding .tickets history unless editing for consistency).

## Design

Rationale from conversation: one knob for operators; accept possible shared-remote contention and address via stress ticket. Product/test isolation rules (per-case cwd, injected MCP) unchanged.

## Acceptance Criteria

No GITERLOPER_REMOTE_TEST_CONCURRENCY in code or canonical docs; run-tests.ts has a single concurrency model; ./scripts/check_all.sh green; optional deno task test passes.

