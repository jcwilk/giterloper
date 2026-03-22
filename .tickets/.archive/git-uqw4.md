---
id: git-uqw4
status: closed
deps: [git-hl4d]
links: []
created: 2026-03-22T15:05:27Z
type: feature
priority: 2
assignee: user.email
parent: git-x96q
---
# MCP: fail fast at startup if memsearch unavailable

**Prerequisite:** Close **`git-hl4d`** first so local dev and CI have **`memsearch` on `PATH`** and docs describe install (this ticket’s verification and **`./scripts/check_all.sh`** depend on it).

Implement specs/MCP.md memsearch CLI (mandatory at MCP startup): verify memsearch invocable on PATH during same phase as knowledge-remote validation, both HTTP/SSE (lib/gl-mcp-server.ts) and stdio (lib/gl-mcp-server-stdio.ts), shared helper from createServer or equivalent. Non-zero exit, clear stderr, before listen/accept. Parity between transports. Respect narrow test-only hook only for asserting failure modes per spec.

## Acceptance Criteria

Production entrypoints exit at boot with clear error when memsearch missing. Both transports share one check. In-process tests that start full server either have memsearch in env or use documented failure-only hook. ./scripts/check_all.sh passes in CI with memsearch installed per docs.

