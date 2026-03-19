---
id: skr-jx74
status: closed
deps: []
links: []
created: 2026-03-19T20:46:18Z
type: feature
priority: 1
assignee: user.email
parent: skr-scn7
---
# Reorganize tests into topic directories (mcp, cli, core) and update runners

Replace type-centric layout (tests/unit vs tests/e2e) with topic-oriented directories such as tests/mcp/, tests/cli/, and tests/core/ (exact names adjustable but must be semantic topics, not duration or test style). Update scripts/check_all.sh, deno.json tasks, and any CI/docs so one command runs the full suite. Goal: when validating changes, runners do not split by arbitrary test kind; everything expected in CI runs together. Include renaming scripts: e.g. scripts/run-e2e.ts → scripts/run-mcp-tests.ts or fold into a single deno test invocation over tests/.

## Acceptance Criteria

grep/docs show no stale tests/e2e-only CI path as the primary gate; deno task or check script runs all topic suites; file tree matches agreed naming; README documents how to run the full suite locally.

## Closure

- Tests live under `tests/core/`, `tests/cli/`, and `tests/mcp/`; shared remote/test constants moved to `tests/helpers/config.ts` (formerly `tests/e2e/config.ts`).
- `scripts/run-e2e.ts` replaced by `scripts/run-tests.ts`: one `deno test -A` over the three topic directories, then existing leaked-pin cleanup across `.giterloper/sessions/*`.
- `scripts/check_all.sh` and `deno task check` run typecheck + `run-tests`; `deno.json` adds `test` and `test:core|cli|mcp`. Updated `AGENTS.md`, root `README.md`, `tests/README.md`, and `.cursor/agents/verifier.md`.
- Verified: `./scripts/check_all.sh` (127 passed); `reference_client` `deno test -A tests/`.

