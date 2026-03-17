---
id: git-0wnp
status: closed
deps: []
links: []
created: 2026-03-17T02:43:35Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Correct pin_set semantics and eager branch push

pin_set incorrectly always changes the session default pin. It should only affect the default when called without a pin name. Named pins should be upserted independently. Additionally, assigning a branch to a pin should eagerly push the branch to the remote if it doesn't exist yet, and fail with details if the remote branch SHA mismatches.

