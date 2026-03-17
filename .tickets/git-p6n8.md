---
id: git-p6n8
status: open
deps: []
links: []
created: 2026-03-17T02:44:00Z
type: task
priority: 1
assignee: user.email
parent: git-0wnp
---
# pin_set: Branch + pin name creates snapshot pin

When pin_set is called with both a branch and a pin name, it should create (or update) a named pin using the default pin's current SHA and the specified branch. This is a 'snapshot of current progress' — the new pin captures where the default pin is at right now. The default pin is NOT affected.

## Design

In the named-pin + branch path: resolve default pin for SHA/source, create/update the named pin with that SHA and the given branch. If source is explicitly provided, use it; otherwise inherit from default. Do not reorder pins.

## Acceptance Criteria

Calling pin_set with branch + pin name creates a new pin (or updates existing) at the default pin's current SHA with the given branch. Default pin is unaffected. Source is inherited from default unless explicitly overridden.

