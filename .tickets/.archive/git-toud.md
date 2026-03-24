---
id: git-toud
status: closed
deps: [git-xaio]
links: []
created: 2026-03-24T05:35:41Z
type: feature
priority: 1
assignee: user.email
parent: git-wiud
---
# Lib: resolve MCP test session parent for makeState + mcp-session-store

Implement single resolution helper in **lib/session-layout.ts** (export constant **GITERLOPER_MCP_TEST_SESSION_PARENT** env key matching `git-xaio`): **validate and normalize** path (reject `..` / unsafe segments; resolve relative values per `git-xaio` anchor); effective parent for `giterloperSessionsRoot` in MCP test mode when override set; **`makeState`** keeps `projectRoot` = product root (`projectRoot()` / repo) but `sessionsRoot` = `join(effectiveParent, '.giterloper_test')` in test mode. **mcp-session-store** `giterloperRootPath` must match `makeState` (remove duplicate `PROJECT_ROOT_ENV` logic — share helper). **integrationMcpModeChildEnv** (and any gl/MCP spawn env merge) passes through the session-parent var when present in the parent process so children inherit. **Parity:** stdio and HTTP MCP test spawns get the same merged env.

**In-process factories:** Prefer reading this env only where subprocess inheritance already applies; document in closure if `createMcpAppForTest` / parallel in-process cases need a future explicit option (`git-8qen` follow-up).

## Acceptance Criteria

- Unit tests in `tests/core/` for layout; **no** constitution path regression (`state.projectRoot` still repo root when `cwd` is repo).
- Session paths under a **temp** or explicit directory when env set (full `tests/roots/...` wiring is `git-jp1p`/`git-y614`; lib tests need not wait on allocator).
- Audit call sites that assumed `.giterloper_test` lives directly under `GITERLOPER_PROJECT_ROOT` (helpers/tests) and note follow-ups for `git-5skn`/`git-8qen` if out of scope.
