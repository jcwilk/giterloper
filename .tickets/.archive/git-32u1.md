---
id: git-32u1
status: closed
deps: []
links: []
created: 2026-03-15T22:01:49Z
type: task
priority: 2
assignee: user.email
parent: git-0fof
---
# Pending timestamp: use API instead of git log

getPendingInCommitOrder in lib/reconcile.ts currently uses git log for add timestamp, which likely fails with shallow clones. Change to obtain add/commit order via the API (e.g. GitHub API or equivalent) so it works with shallow clones.

