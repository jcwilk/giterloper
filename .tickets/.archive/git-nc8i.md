---
id: git-nc8i
status: closed
deps: [git-8vrv, git-hv9f]
links: []
created: 2026-03-17T08:31:25Z
type: task
priority: 1
assignee: user.email
parent: git-6elj
---
# Expand regression tests for pin_set mismatch cases

Add/adjust unit tests (and MCP-level integration checks as needed) covering the mismatch scenarios: omitted args behavior, _session handling, branch/ref matrix, unknown-arg rejection, and descriptor/runtime parity. Include negative tests for branch SHA mismatch and missing remote SHA when applicable to canonical behavior.

## Acceptance Criteria

Tests fail before fix and pass after fix; tests cover positive and negative matrix cases; descriptor/runtime parity assertions are included; CI-targeted test command is documented in ticket notes

## Notes

CI test command: `deno test -A tests/unit/mcp-pin-set.test.ts`

