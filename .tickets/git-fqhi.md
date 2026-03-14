---
id: git-fqhi
status: open
deps: [git-6ens, git-j6xv, git-893e]
links: []
created: 2026-03-14T19:02:49Z
type: feature
priority: 2
assignee: user.email
parent: git-mowe
---
# Create minimal external reference_client

Add ./reference_client as a minimal external MCP consumer using Deno/TypeScript, with no shared server core imports.

## Design

Client should exercise read, intake, and reconcile flows over MCP HTTP/SSE only. Keep implementation minimal and explicit about endpoint configuration. Tests must use relative ../ paths to run/target local giterloper server processes.

## Acceptance Criteria

- reference_client exists and runs independently of server internals.\n- Tests connect through MCP over HTTP/SSE, not direct library calls.\n- Tests use relative ../ pathing where needed to access giterloper workspace assets.\n- Client README explains minimal usage and constraints.

