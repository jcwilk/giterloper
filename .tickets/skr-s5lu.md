---
id: skr-s5lu
status: open
deps: [skr-nx83]
links: []
created: 2026-03-19T20:46:17Z
type: task
priority: 1
assignee: user.email
parent: skr-scn7
---
# Document source-of-truth hierarchy in AGENTS.md

Add a clear, durable section to AGENTS.md (or the most appropriate top-level agent doc) stating precedence when sources conflict: (1) documentation, CLI help, and MCP tool descriptions/strings are highest; (2) tests override implementation when they disagree with code but not when they disagree with (1); (3) implementation is lowest. Clarify that changing (1) requires explicit user direction. This encodes the workflow the user described for agents and humans.

## Design

Keep the section short and normative; avoid duplicating full spec content—point to PIN_SETTING_PARAM_BEHAVIOR.md and MCP contract docs for behavioral detail.

## Acceptance Criteria

AGENTS.md (or chosen file) contains explicit numbered hierarchy and examples of conflict resolution; cross-link from README or CONTRIBUTING if those files exist and mention agent guidance.

