---
id: git-ftwq
status: closed
deps: []
links: []
created: 2026-03-20T01:18:22Z
type: task
priority: 0
assignee: user.email
parent: git-0i1b
---
# Flatten session paths: .giterloper/<sessionId>/ (remove sessions/ segment)

Migrate all production path resolution from .giterloper/sessions/<sessionId>/ to .giterloper/<sessionId>/ so only session-id directories exist under .giterloper/. Touch lib (paths, gl-core, mcp-session-store, locking if any), CLI/MCP entrypoints, and any code that joins sessions/ in path helpers.

## Design

Authoritative product layout is described in docs/DEPLOYMENT_REQUIREMENTS.md and docs/TEST_PARALLELISM_PLAN.md. Pin/MCP semantics unchanged: docs/PIN_SETTING_PARAM_BEHAVIOR.md, MCP.md.

## Acceptance Criteria

deno check lib/gl.ts passes. No remaining code path constructs .giterloper/sessions/ for new state (grep or structural). gl and gl-maintenance operate correctly with default _cli and arbitrary --session-id. Existing tests updated to expect new paths OR intermediate compatibility removed in same change set as agreed in ticket. Evidence: ./scripts/check_all.sh green after dependent test updates land (may coordinate with follow-up tickets if split).

