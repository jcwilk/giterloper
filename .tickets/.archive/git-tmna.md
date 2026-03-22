---
id: git-tmna
status: closed
deps: [git-ftwq]
links: []
created: 2026-03-20T01:18:23Z
type: task
priority: 0
assignee: user.email
parent: git-0i1b
---
# TestRuntimeContext + CLI/maintenance helpers (per-case cwd and session)

Add a shared test runtime context (tests/helpers) with unique sessionId, runId, temp cwd, and helpers for names under ctx. Refactor runGl/runGlMaintenance (and JSON variants) to require context or explicit cwd+sessionId defaulting to ctx.cwd; stop defaulting integration subprocesses to repo root for mutable state.

## Design

Align with tests/README.md TestRuntimeContext section and docs/TEST_PARALLELISM_PLAN.md. CLI tests must not rely on implicit _cli for shared pinned.yaml contention.

## Acceptance Criteria

Integration helpers document and enforce per-case cwd. CLI topic tests updated to use context pattern. giterloperSessionRoot matches flattened layout (no sessions segment). Evidence: deno test for tests/cli/ passes under current runner; no test assumes repo-root .giterloper for exclusive state.

