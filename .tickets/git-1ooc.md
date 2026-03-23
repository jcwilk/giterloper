---
id: git-1ooc
status: open
deps: []
links: []
created: 2026-03-23T05:12:32Z
type: chore
priority: 1
assignee: user.email
parent: git-vqsn
---
# Remove duplicate tests/pin tree

tests/pin/ contains byte-identical copies of tests/mcp/mcp-pin-set.test.ts, tests/mcp/mcp-merge.test.ts, and tests/core/pin-lifecycle.test.ts. scripts/discover-test-cases.ts recurses all tests/**/*.test.ts, so the suite runs those logical cases twice and risks divergent edits. Normative pairing is tests/mcp/ -> specs/MCP.md and tests/core/ -> specs/core.md (+ specs/pin-semantics.md for pin_set); there is no specs-backed reason for a parallel tests/pin/ subtree.

## Acceptance Criteria

tests/pin/ directory removed (or, if a product decision requires it, tests/README and discover-test-cases document and enforce a single canonical path—default expectation is removal). Verify discovery has no `tests/pin/` paths (e.g. `deno run -A scripts/discover-test-cases.ts` JSON must not contain `tests/pin/`). `deno task test` or `deno run -A scripts/run-tests.ts` passes. Note: the harness only rejects duplicate static test names **within the same file**; the goal of removal is to stop scheduling the same logical cases twice from mirrored files, not to assert global name uniqueness across the tree unless tooling is added for that.

