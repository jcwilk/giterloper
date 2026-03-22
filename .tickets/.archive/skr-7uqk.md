---
id: skr-7uqk
status: closed
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


## Notes

**2026-03-19T21:19:51Z**

Required sessionId in tests/helpers/runGl*; newTestCliSessionId + giterloperSessionRoot. E2e files use per-file TEST_SESSION + glj/glm wrappers. cleanupTestKnowledgeRepo requires sessionId when pinName set. run-e2e leak cleanup scans all .giterloper/sessions/*. reference_client test_helpers + client.test pass RC_SESSION. tests/README documents convention. Verified: deno test unit, run-e2e, reference_client tests, deno test tests/e2e --parallel.
