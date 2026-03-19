---
id: git-zva8
status: closed
deps: []
links: []
created: 2026-03-17T02:44:09Z
type: task
priority: 1
assignee: user.email
parent: git-0wnp
---
# Eager branch push on pin creation

When a branch is assigned to a pin (via pin_set or any path that sets a branch), the branch should be pushed to the remote immediately — not deferred until the first write. If the branch does not exist on the remote, push it now. If the branch already exists on the remote but its SHA differs from the pin's SHA, fail with an error that includes both the pin SHA and the remote SHA, explaining the mismatch.

## Design

After setting a pin's branch, call resolveBranchShaReachable. If remoteSha is null (branch not on remote), clone/checkout the branch and push it immediately. If remoteSha differs from pin.sha, return an error envelope with code 'branch_sha_mismatch' including pin SHA, remote SHA, branch name, and pin name. This replaces the current deferred-push-on-write pattern for new branches.

## Acceptance Criteria

Assigning a non-existent remote branch to a pin pushes it immediately. Assigning a branch that exists remotely at a different SHA fails with a clear error including both SHAs. No branch push is deferred to first write.

