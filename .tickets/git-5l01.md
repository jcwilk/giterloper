---
id: git-5l01
status: closed
deps: [git-jk2d]
links: []
created: 2026-03-16T00:22:08Z
type: feature
priority: 1
assignee: user.email
parent: git-6wkq
---
# Session-local pin registry and default resolver

Refactor pin registry utilities to operate per-session: initialize session pinned.yaml, resolve explicit pin or session default, create named/auto-named checkpoint pins, and remove lock-based mutation dependency from MCP pin flows.

## Acceptance Criteria

Pin mutations for MCP no longer require withFifoLock; explicit reserved name default is rejected in all pin-name-bearing inputs; default resolution behavior is unit-tested.

