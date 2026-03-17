---
id: git-20k5
status: open
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

There is exactly one session default pin in a session, exposed as 'default'.\nCalling giterloper_pin_set with an existing pin name sets/keeps that pin as default.\nCalling giterloper_pin_set with a non-existent name creates that pin in session state and sets it as default.\nTools that omit the pin parameter resolve through the session default pin semantics.\nTool docs and error messages reflect create-or-select behavior.

