---
id: git-8qen
status: closed
deps: [git-y614]
links: []
created: 2026-03-24T05:35:41Z
type: task
priority: 2
assignee: user.email
parent: git-wiud
---
# Regression tests: isolation + subprocess inheritance

Add or extend tests under **`tests/core/`** / **`tests/mcp/`** as appropriate:

1. Two processes (or sequential env swap) with **different** `GITERLOPER_MCP_TEST_SESSION_PARENT` values do not read/write the same session dir for the same `sessionId`.
2. **`runGl`** / MCP integration spawn inherits session-parent from parent env (via `integrationMcpModeChildEnv` + harness pattern).
3. In-process **`createMcpAppForTest`** still respects product `projectRoot` vs session tree; **`withIsolatedGiterloperProjectRoot`** remains valid where parallel in-process cases need serialization — document a **follow-up** ticket if an explicit `projectRoot` / session-parent option on the factory is deferred.

## Acceptance Criteria

- New tests pass under `./scripts/check_all.sh` (or targeted `deno task test` cases cited in closure note).
- Closure note lists **test file paths** and the behaviors they lock; verifier can re-run those cases.

## Notes

**2026-03-24T06:21:33Z**

Closure: tests/core/session-layout.test.ts — isolation (different session parents, same sessionId → different dirs). tests/core/integration-session-parent-child-env.test.ts — child inherits GITERLOPER_MCP_TEST_SESSION_PARENT via same env merge as runGl/mcp-subprocess (printenv). Follow-up git-z8do for createMcpAppForTest explicit sessionParent; gl-mcp-server comment updated. Re-run: deno test -A tests/core/session-layout.test.ts tests/core/integration-session-parent-child-env.test.ts
