---
id: git-bp15
status: open
deps: [git-0ye3, git-7n1b, git-p6n8, git-zva8]
links: []
created: 2026-03-17T02:44:18Z
type: task
priority: 2
assignee: user.email
parent: git-0wnp
---
# Update MCP tool descriptions and docs for corrected pin_set semantics

After the pin_set behavior changes, update all documentation to reflect the corrected semantics: (1) MCP tool description strings in gl-mcp-server.ts for pin_set and related tools, (2) reference_client/README.md usage examples and tool table, (3) AGENTS.md sections on pinned.yaml and MCP server, (4) any other docs that describe pin_set or default pin behavior. Descriptions should clearly explain: no pin name = view/configure default; pin name = upsert named pin without changing default; branch-only = update default's branch; branch + name = snapshot.

## Acceptance Criteria

All MCP tool description strings accurately describe the new semantics. reference_client README examples are correct. AGENTS.md is updated. No stale references to the old create-or-select-default behavior remain.

