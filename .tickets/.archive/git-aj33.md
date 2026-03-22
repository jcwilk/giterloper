---
id: git-aj33
status: closed
deps: [git-mrig, git-6dwk]
links: []
created: 2026-03-21T21:18:06Z
type: task
priority: 2
assignee: user.email
parent: git-0kbo
---
# Tests + reference_client: remove duplicate retry layers

After lib is authoritative (git-mrig, git-6dwk): remove reqToolJson from tests/mcp/mcp-pin-set.test.ts; use direct req + parseToolResult; keep withIsolatedGiterloperProjectRoot. tests/helpers/run-git.ts becomes thin re-export/wrapper around lib helper or delete if redundant. Trim runGl/runGlMaintenance retries in tests/helpers/gl.ts to 0–2 outer attempts only if still needed for process-level flakes; remove duplicated regex lists. reference_client/client.ts: remove or shrink callToolJson—prefer disappearance once server/lib retries suffice; if kept, transport-only retry without duplicating git error regexes.

## Acceptance Criteria

No duplicate MCP_REMOTE / GIT_TRANSIENT regex blocks between reference_client, mcp-pin-set.test, run-git.ts, and gl.ts beyond minimal unavoidable test-only glue. deno check; ./scripts/check_all.sh passes. docs/PIN_SETTING_PARAM_BEHAVIOR.md behavior unchanged for pin_set tests.

