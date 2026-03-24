---
id: git-6m0f
status: open
deps: []
links: []
created: 2026-03-24T17:07:52Z
type: task
priority: 1
assignee: user.email
parent: git-rv1n
---
# Add external git/GitHub retry logging to CONVENTIONS.md

Move the substance of AGENTS.md **External retries** into CONVENTIONS.md (new subsection): centralized retries in lib/retry-external.ts; bounded attempts + jitter; append-only JSON lines to logs/giterloper-retry.log (or GITERLOPER_PROJECT_ROOT); fields at high level; stderr fallback if log unavailable; MCP/CLI JSON stdout stays free of retry noise; optional epic git-0kbo reference.

Sibling **git-7cxd** removes the External retries section from AGENTS.md after this ticket closes (dependency ordering). This ticket **only** edits CONVENTIONS.md.

**Placement note:** Some critics suggested `docs/` for operational retry logging; this epic keeps CONVENTIONS.md per maintainer direction—keep the subsection concise so CONVENTIONS does not become a second ops manual.

## Acceptance Criteria

- CONVENTIONS.md contains a clear subsection on external retries and log location/behavior.

