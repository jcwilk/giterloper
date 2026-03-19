---
id: skr-7uqk
status: open
deps: []
links: []
created: 2026-03-19T20:46:19Z
type: feature
priority: 1
assignee: user.email
parent: skr-scn7
---
# Shared test helpers: unique session IDs for parallel CLI and maintenance tests

Eliminate shared _cli session contention so Deno can run CLI- and maintenance-backed tests in parallel. Provide a small shared helper (or pattern) that generates a per-test or per-file session id and threads it through existing helpers (e.g. tests/helpers/gl.ts runGl/runGlMaintenance runGlJson) via --session-id. Update assertions that hardcode .giterloper/sessions/_cli paths to use the active session. Document the pattern in README for contributors.

## Acceptance Criteria

No production test relies on implicit _cli for isolation; parallel deno test with multiple CLI tests does not flake pinned.yaml; README states the session-id convention.

