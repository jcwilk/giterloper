---
id: git-snjk
status: closed
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

## Children (all closed)

- git-k9pg — AST fail-closed test discovery module
- git-od4q — Harness: discovery, JUnit ≥1 test ran, manifest removed
- git-4azd — MCP HTTP client migrated to `tests/helpers/`
- git-ncc2 — `reference_client/` removed, repo hygiene
- git-i3e8 — Docs + `specs/MCP.md` alignment

## Closure

Epic acceptance verified 2026-03-22: deliverables live on `HEAD` (AST discovery + SWC pin, unified runner with JUnit gate and mandatory stderr case count, no manifest path, `tests/helpers/mcp-http-client.ts` + `tests/mcp/mcp-search-tool.test.ts`, no `reference_client/`). `./scripts/check_all.sh` green (163 discovered cases at time of close).

