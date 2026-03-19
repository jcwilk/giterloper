---
id: skr-vakd
status: open
deps: [skr-jx74, skr-7uqk]
links: []
created: 2026-03-19T20:46:24Z
type: feature
priority: 1
assignee: user.email
parent: skr-scn7
---
# Migrate former e2e CLI scenarios into cli/core tests; keep MCP as higher-level integration

Split responsibilities per user intent: MCP-focused tests cover the real end-to-end agent path (HTTP or stdio client against MCP server, live remote as today). Command-line gl and gl-maintenance flows that currently live under tests/e2e move into tests/cli/ (or tests/core/) as faster, parallel-friendly tests using session helpers. Remove the framing that every git-remote scenario is e2e; each CLI subcommand-sized behavior should be unit-testable with injected configuration. Preserve behavioral coverage—no silent drops—map old cases to new locations in ticket notes. Live GitHub/API usage remains acceptable for MCP integration tests during this refactor; adding mocks or recordings for MCP remote calls is explicitly out of scope until structure stabilizes.

## Acceptance Criteria

Former e2e CLI files removed or reduced to thin MCP-only wrappers; coverage list in ticket notes maps old tests → new paths; MCP suite still exercises pin_set/insert/reconcile/retrieve/merge paths against real remote per current policy; verifier can run full suite.

