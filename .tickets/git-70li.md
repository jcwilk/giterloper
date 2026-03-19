---
id: git-70li
status: closed
deps: []
links: []
created: 2026-03-19T02:54:32Z
type: task
priority: 1
assignee: user.email
parent: git-3yyh
---
# Fix legacy non-session pinned.yaml test references

Delete or revise all non-historical references from #4: tests/unit/paths.test.ts currently uses mocked non-session path /proj/.giterloper/pinned.yaml; tests/unit/mcp-error-mapping.test.ts asserts legacy message text 'no pins configured in .giterloper/pinned.yaml'. Update fixtures/assertions to session-scoped paths or path-agnostic matching consistent with current runtime behavior.

## Design

Keep tests validating behavior, not outdated path literals. Align expectations with makeState(sessionId) and state.pinnedPath-based errors. Prefer robust assertions that survive future root path changes while preserving contract semantics.

## Acceptance Criteria

Unit tests no longer encode non-session pinned.yaml path assumptions in these files. Assertions pass using session-scoped/path-agnostic expectations and remain aligned with docs/PIN_SET_CONTRACT.md and docs/PIN_SETTING_PARAM_BEHAVIOR.md.

