---
id: git-cj0u
status: open
deps: []
links: []
created: 2026-03-18T21:26:51Z
type: epic
priority: 1
assignee: user.email
---
# Epic: Restore check_all with spec-first pin semantics

Restore ./scripts/check_all.sh to green while preserving canonical pin semantics defined by docs/PIN_SETTING_PARAM_BEHAVIOR.md and docs/PIN_SET_CONTRACT.md. Any fix must keep explicit pin: '_session' invalid at API boundaries, and only omitted pin may target the session pin.

