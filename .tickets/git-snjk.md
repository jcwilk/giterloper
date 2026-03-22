---
id: git-snjk
status: open
deps: []
links: []
created: 2026-03-22T18:52:57Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Dynamic harness (AST discovery, junit gate, drop reference_client)

Source plan: [.cursor/plans/dynamic_runner_hardened_10c3029f.plan.md](../.cursor/plans/dynamic_runner_hardened_10c3029f.plan.md).

**Deliverables (child tickets):** AST fail-closed `scripts/discover-test-cases.ts` + pinned parser in root `deno.json` / `deno.lock`; `scripts/run-tests.ts` consumes discovery, JUnit gate (>=1 test per subprocess), delete `tests/test-case-manifest.json`, `scripts/build-test-case-manifest.ts`, and `deno.json` `gen:test-manifest`; move MCP HTTP client + search E2E into `tests/`; delete `reference_client/` and fix `.dockerignore`; align `specs/MCP.md`, `tests/README.md`, `AGENTS.md`, `README.md`, `tests/helpers/integration-mcp-env.ts` with final harness and executable-test locus.

**Out of scope:** no dedicated unit tests for the discover module; no `docs/` rehome of a minimal MCP client demo.

**Execution order (deps):** git-k9pg → git-od4q → git-4azd → git-ncc2 → git-i3e8.

