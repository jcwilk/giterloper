---
id: git-2r5p
status: closed
deps: [git-zdbt]
links: []
created: 2026-03-16T00:22:19Z
type: task
priority: 1
assignee: user.email
parent: git-6wkq
---
# Migrate MCP docs and tests to session-first flow

Update MCP.md behavior contract plus unit/E2E/reference-client workflows to session-first operation, covering initialize-before-tools enforcement, default-pin operation, named+auto checkpoint pins, reconcile defaults, cleanup routes, and cross-session isolation.

## Acceptance Criteria

MCP.md reflects new API/lifecycle; unit and E2E tests cover required session/default-pin and cleanup/isolation behavior; tests validate default reserved-name rejection.

