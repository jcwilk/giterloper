---
id: git-mh2m
status: open
deps: []
links: []
created: 2026-03-15T22:01:47Z
type: task
priority: 2
assignee: user.email
parent: git-0fof
---
# Simplify reconcile: remove optional stripFn

In lib/reconcile.ts, mergeTopicContent has an optional stripFn that is never overridden. Remove the parameter and use the default (stripBoilerplate) directly so the API is simpler.

