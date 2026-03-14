---
id: git-dadj
status: open
deps: [git-1ua8]
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

Implement index manager keyed by full tuple (pinName, sha). Persist index metadata that records pin, sha, source path, and build fingerprint. Queries must fail closed when metadata does not match requested pin+sha. Build-on-demand is allowed but must never fall back to another version's index.

## Acceptance Criteria

- Index namespace is unique per pin+sha.\n- Querying pin+sha A can never read index for pin+sha B.\n- Stale/mismatched metadata causes explicit failure, not fallback.\n- Rebuild behavior for missing index is deterministic and documented.

