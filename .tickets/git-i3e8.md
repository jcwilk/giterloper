---
id: git-i3e8
status: closed
deps: [git-ncc2]
links: []
created: 2026-03-22T18:53:06Z
type: task
priority: 2
assignee: user.email
parent: git-snjk
---
# Docs + specs/MCP.md: harness + executable tests alignment

Per plan §5: `tests/README.md` — runtime AST discovery (pointer to `scripts/discover-test-cases.ts` / limits), **no** manifest / `gen:test-manifest`, optional mention of mandatory stderr case count + JUnit >=1-test gate (once `git-od4q` behavior exists), `DENO_JOBS` and isolation unchanged, `.giterloper` / `.giterloper_test` hygiene as today; update intro if it still says manifest-only mechanics. Memsearch bullet: **`tests/mcp/`** only (drop `reference_client`). Repoint integration-env requirement from `reference_client/test_helpers.ts` to canonical helpers (`integration-mcp-env.ts`, `gl.ts`, `createMcpAppForTest` as appropriate).

`AGENTS.md` harness paragraph aligned with `tests/README.md`. `README.md`: **confirm** no `reference_client` quickstart (if already absent, no gratuitous churn). `tests/helpers/integration-mcp-env.ts` comment: no stale `reference_client` pointer.

## Design

Normative: `specs/MCP.md` executable-tests bullet references **`tests/mcp/`** only for `giterloper_search` / memsearch provisioning (pair with `tests/README.md` per AGENTS.md). Do NOT add `docs/` minimal MCP client snippet (out of scope).

## Acceptance Criteria

- `specs/MCP.md`, `tests/README.md`, `AGENTS.md`, `README.md`, `tests/helpers/integration-mcp-env.ts` updated as above; `rg reference_client` clean on those paths (and consistent story with MCP.md).
- Hierarchical pairing between `specs/MCP.md` and user-facing harness strings preserved.
- No new `docs/` MCP client demo.

