---
id: git-zdbt
status: open
deps: [git-c7iy]
links: []
created: 2026-03-16T00:22:15Z
type: task
priority: 2
assignee: user.email
parent: git-6wkq
---
# Session cleanup module and lifecycle hooks

Implement isolated session store/cleanup module (e.g. lib/mcp-session-store.ts) with explicit cleanup via giterloper_session_end, protocol DELETE /mcp teardown, and stale-session scavenging by last-activity TTL; optional lazy cleanup for unknown/expired sessions.

## Acceptance Criteria

Both explicit cleanup paths remove session-local state best-effort; stale sessions are scavenged by TTL; logic remains decoupled from tool handlers.

