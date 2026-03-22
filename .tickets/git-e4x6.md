---
id: git-e4x6
status: open
deps: [git-9btr]
links: []
created: 2026-03-22T00:21:38Z
type: task
priority: 1
assignee: user.email
parent: git-zbfq
---
# Author specs/core.md (strict coverage vs tests/core)

Add specs/core.md: same constraints as CLI spec for tests/core/* and shared library semantics (pins, paths, git orchestration, retries, memsearch boundaries, reconcile/add-queue, etc.). Minimize overlap with specs/MCP.md and specs/cli.md; where overlap exists it must be consistent. Initial pass: full strict coverage of core test topics.

## Acceptance Criteria

specs/core.md exists; strict coverage vs tests/core; length ~2 pages target; consistent with sibling specs where they touch.

