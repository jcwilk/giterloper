---
id: git-20k5
status: closed
deps: []
links: []
created: 2026-03-17T02:12:56Z
type: feature
priority: 1
assignee: user.email
parent: git-y28q
---
# MCP: Make pin_set create-or-select session default pin

Update MCP pin_set behavior so it represents the one session default pin named 'default'. Calling pin_set with a new name should initialize that pin within the active session instead of failing or only reordering existing pins.

## Acceptance Criteria

- There is exactly one session default pin in a session, exposed as `default`.
- Calling `giterloper_pin_set` with an existing pin name sets or keeps that pin as default.
- Calling `giterloper_pin_set` with a non-existent name creates that pin in session state and sets it as default.
- Tools that omit the `pin` parameter resolve through the session default pin semantics.
- Tool docs and error messages reflect create-or-select behavior.

