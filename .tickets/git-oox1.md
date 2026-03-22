---
id: git-oox1
status: open
deps: [git-9btr, git-6uc2, git-e4x6, git-6g05, git-46zo]
links: []
created: 2026-03-22T00:21:44Z
type: task
priority: 2
assignee: user.email
parent: git-zbfq
---
# Update tests/README.md for strict spec anchoring

Document folder pairing tests/cli↔specs/cli.md, tests/core↔specs/core.md, tests/mcp↔specs/MCP.md; tests exist to strengthen coded behavior ↔ spec constraints; strict rule—no tests for behavior without spec representation (and initial rollout requires every current test theme mirrored in specs). Mention hierarchical alignment: commits should group spec/test/code changes deliberately when touching the same behavior. Remove/stale-fix references to deleted docs (e.g. parallelism plan).

## Acceptance Criteria

tests/README.md matches new model; no stale doc pointers; strict anchoring stated clearly.

