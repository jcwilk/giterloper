---
id: git-knna
status: open
deps: [git-1ooc]
links: []
created: 2026-03-23T05:12:32Z
type: task
priority: 1
assignee: user.email
parent: git-vqsn
---
# Update MCP pin test comments to cite specs/pin-semantics.md

After 8a61492, pin matrix SOT is specs/pin-semantics.md (not specs/core.md). tests/mcp/mcp-pin-set.test.ts and tests/mcp/mcp-merge.test.ts still have block comments referencing specs/core.md sections. Update comments to pin-semantics.md and match current headings (e.g. Merge tool exception, branch and ref matrix cases 1–4, Pin storage, Error codes). Repository identity bullets should cite specs/MCP.md + specs/pin-semantics.md as applicable.

## Acceptance Criteria

Grep under tests/mcp/ for mcp-pin-set|mcp-merge finds no specs/core.md references that mean pin_set/branch-ref semantics. Comments remain accurate to pin-semantics.md. No behavior/assertion changes required unless a comment reveals real spec drift.

