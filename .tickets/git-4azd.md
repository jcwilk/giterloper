---
id: git-4azd
status: closed
deps: [git-od4q]
links: []
created: 2026-03-22T18:53:04Z
type: task
priority: 2
assignee: user.email
parent: git-snjk
---
# Migrate reference_client MCP HTTP client into tests/helpers

Per plan §4: move `reference_client/client.ts` to `tests/helpers/mcp-http-client.ts` (or agreed name). **`mcp-http-client.ts` MUST have zero `lib/` imports** (external-consumer boundary). Other folded helpers may import `lib/` where already canonical (e.g. `lib/session-layout.ts` via existing `tests/helpers` patterns).

Fold `reference_client/test_helpers.ts` pieces into existing helpers (`mcp-subprocess.ts`, `gl.ts`, etc.) using `integrationMcpModeChildEnv`, `denoArgsForMcpHttpServer`, **`GITERLOPER_TEST_MCP_STATE_SESSION_ID`** for the **search** scenario (align with former `reference_client` search test — not necessarily every pattern in `gl-mcp-workflow.test.ts`).

## Design

Add `tests/mcp/mcp-search-tool.test.ts` that **owns** the former **`search returns results`** E2E (HTTP MCP + memsearch on PATH; assertions/messages comparable to `reference_client/tests/client.test.ts`). Update `tests/mcp/gl-mcp-workflow.test.ts` imports to the new helper path; optionally dedupe `startMcpServer` / `waitForServer` into a shared helper if low-conflict.

Non-search `reference_client` cases are **out of scope** here; plan assumes overlap with existing `tests/mcp/*`. **`reference_client/`** may remain on disk until **git-ncc2** but must not be imported from `tests/**` after this ticket.

## Acceptance Criteria

- `deno task test` passes after **git-od4q** (discovery includes `gl-mcp-workflow` + new file).
- `deno check` (or equivalent) clean for `tests/helpers/mcp-http-client.ts` and touched MCP tests.
- **`tests/**` has no import paths under `reference_client/`** (tree may still exist unused until **git-ncc2**).
- Moved HTTP client module has **zero** `lib/` imports.
- Search E2E behavior equivalent to prior `reference_client` search test.

