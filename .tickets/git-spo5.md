---
id: git-spo5
status: open
deps: []
links: []
created: 2026-03-15T22:01:51Z
type: bug
priority: 2
assignee: user.email
parent: git-0fof
---
# Branch freshness: fail when remote unreachable

In lib/branch.ts, assertBranchFresh currently skips the check when pin has no branch or resolveBranchShaSoft returns null (e.g. remote unreachable). Change so that when we need to check freshness but cannot reach the remote, the operation fails with an error code to the client instead of silently proceeding.

