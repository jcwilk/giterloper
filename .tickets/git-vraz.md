---
id: git-vraz
status: closed
deps: [git-l2sv, git-cfer]
links: []
created: 2026-03-16T20:41:56Z
type: task
priority: 1
assignee: user.email
parent: git-jwl2
---
# Add transport parity smoke tests

Introduce a minimal parity smoke harness that runs equivalent initialize/list/basic-call checks across HTTP and stdio. Keep comprehensive behavior coverage in existing HTTP tests to avoid duplicated suites.

## Acceptance Criteria

- Smoke coverage exists for both transports using common assertions\n- Tests prove stdio wiring and session-id injection behavior\n- No broad duplicate tool-by-tool test matrix introduced

