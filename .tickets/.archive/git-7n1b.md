---
id: git-7n1b
status: closed
deps: []
links: []
created: 2026-03-17T02:43:54Z
type: task
priority: 1
assignee: user.email
parent: git-0wnp
---
# pin_set: Branch-only call updates default pin's branch

When pin_set is called with only a branch (no pin name), it should update the default pin to use that branch at the default pin's current SHA. For a new session the default pin's SHA is remote main's HEAD. This gives the agent a way to start a working branch from current state without naming a new pin.

## Design

In the no-pin-name path, if branch is provided: read the current default pin, set its branch to the provided value, keep its SHA. Write back and return updated default pin info. If no default exists, fail with explanation.

## Acceptance Criteria

Calling pin_set with only a branch (no pin name) changes the default pin's branch field to the given value, keeping its SHA. Return confirms the updated default pin with the new branch.

