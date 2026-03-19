---
id: git-dadj
status: closed
deps: [git-1ua8, git-cu4d]
links: []
created: 2026-03-14T19:02:49Z
type: feature
priority: 0
assignee: user.email
parent: git-mowe
---
# Add memsearch adapter with strict pin+sha isolation

Integrate memsearch as the search/index backend and enforce full isolation per pin+sha so indexes never bleed between versions.

## Design

Implement index manager keyed by full tuple (pinName, sha). Persist index metadata that records pin, sha, source path, and build fingerprint. Queries must fail closed when metadata does not match requested pin+sha. Build-on-demand is allowed but must never fall back to another version's index. Define and document the runtime integration boundary for memsearch from Deno (for example: subprocess CLI adapter or service boundary) so implementation remains deterministic and testable.

## Acceptance Criteria

- Index namespace is unique per pin+sha.
- Querying pin+sha A can never read index for pin+sha B.
- Stale/mismatched metadata causes explicit failure, not fallback.
- Rebuild behavior for missing index is deterministic and documented.
- The memsearch adapter boundary and runtime assumptions are documented and covered by tests.
