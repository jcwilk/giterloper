---
id: git-lyqk
status: closed
deps: [git-lpj8, git-rxfb]
links: []
created: 2026-03-18T21:18:58Z
type: task
priority: 1
assignee: user.email
parent: git-0sqi
---
# Make check_all green and lock regression evidence

After session-pin write-path and omitted-pin test fixes, restore green status for ./scripts/check_all.sh and capture evidence that typecheck, unit, and E2E checks all pass in canonical order.

## Acceptance Criteria

1) ./scripts/check_all.sh exits 0 on a clean branch. 2) tests/e2e/gl-mcp-workflow.test.ts passes (no reserved-name failure in insert_pending workflow). 3) Ticket notes include command output snippets or equivalent evidence for typecheck + unit + E2E pass.

