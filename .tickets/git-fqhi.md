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

Client should exercise read, intake, and reconcile flows over MCP HTTP/SSE only. Keep implementation minimal and explicit about endpoint configuration. Tests must use relative ../ paths to run/target local giterloper server processes. Keep client code independent from server core modules to preserve real external-agent behavior.

## Acceptance Criteria

- `reference_client` exists and runs independently of server internals.
- Tests connect through MCP over HTTP/SSE, not direct library calls.
- Tests use relative `../` pathing where needed to access giterloper workspace assets.
- Client E2E scenarios use `github.com/jcwilk/giterloper_test_knowledge`.
- Client README explains minimal usage and constraints.
