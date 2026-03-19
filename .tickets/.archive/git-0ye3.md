---
id: git-0ye3
status: closed
deps: []
links: []
created: 2026-03-17T02:43:45Z
type: task
priority: 1
assignee: user.email
parent: git-0wnp
---
# pin_set: Named pin upsert without affecting default

When pin_set is called with a pin name, it should upsert that named pin's settings (branch, source, ref) WITHOUT reordering the pin list or changing the session default. Currently it always moves the pin to the front (making it the default). The named-pin path should: (1) if pin exists, update only the provided fields (e.g. add/change branch); (2) if pin does not exist, create it using the default pin's source and SHA as defaults for any fields not provided.

## Design

Remove the reorder-to-front logic from the named-pin path. When the pin exists, merge provided fields. When creating, derive source and sha from the current default pin unless explicitly provided. Return the upserted pin info without a defaultPin field.

## Acceptance Criteria

Calling pin_set with a pin name never changes which pin is the session default. Existing pin fields are updated in-place. New pins inherit source/sha from default when not explicitly provided.

