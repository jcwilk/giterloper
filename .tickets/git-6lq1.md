---
id: git-6lq1
status: open
deps: [git-a4f4]
links: []
created: 2026-03-22T02:43:33Z
type: task
priority: 0
assignee: user.email
parent: git-amyx
---
# MCP: bootstrap _session on every new session before tools

Normative: specs/MCP.md Sessions — when a session becomes active (HTTP after initialize; stdio on attach), ensure **`_session`** exists at the **effective configured knowledge remote** for that server (per **`mcpTestMode`**) at default branch HEAD (SHA stored) before any tool handler runs. Active MCP session must not have empty pins or missing **`_session`** under normal operation.

## Design

Likely touch session factory / stateForSession / touchSession paths in lib/gl-mcp-server.ts and HTTP session lifecycle. After giterloper_session_end or DELETE /mcp, a subsequent new session must bootstrap again.

## Acceptance Criteria

Integration or harness tests prove: fresh MCP session has **`_session`** in **`pinned.yaml`** (or equivalent) before first tool call; the persisted pin list is **non-empty** (at minimum **`_session`**); **`state_inspect`** lists **`_session`**; no **`missing_pin`** solely from empty pins on a new session. Parity: HTTP and stdio behaviors aligned per shared core.

