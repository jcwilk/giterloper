---
id: git-cfer
status: open
deps: [git-odv6, git-dflp]
links: []
created: 2026-03-16T20:41:56Z
type: feature
priority: 1
assignee: user.email
parent: git-jwl2
---
# Add stdio MCP runtime entrypoint

Add a stdio entrypoint that uses the shared MCP core with process-scoped session identity, preserving tool/session semantics while omitting HTTP-only concerns. Include task wiring for local execution.

## Acceptance Criteria

- Stdio runtime starts and serves MCP via stdio transport\n- Shared core is reused (no duplicated tool logic)\n- Stdio path keeps protocol stdout clean and supports session lifecycle expectations

