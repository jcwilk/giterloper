---
id: git-l2sv
status: closed
deps: [git-dflp]
links: []
created: 2026-03-16T20:41:56Z
type: task
priority: 2
assignee: user.email
parent: git-jwl2
---
# Consolidate HTTP app wiring

Refactor HTTP runtime and test app setup to use one factory path for CORS/auth/routes/transport wiring, reducing duplicated logic and parity drift risk inside HTTP itself.

## Acceptance Criteria

- Runtime and test app creation use one shared HTTP wiring path\n- Existing HTTP auth/health/delete semantics preserved\n- Current HTTP unit tests continue to validate behavior

