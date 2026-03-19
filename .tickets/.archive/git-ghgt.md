---
id: git-ghgt
status: closed
deps: [git-w1te, git-k1gj]
links: []
created: 2026-03-17T06:11:50Z
type: task
priority: 0
assignee: user.email
parent: git-amoh
---
# MCP stateForSession: use ensureSessionDir + autoInitSessionPin

Update stateForSession in gl-mcp-server.ts to replace bootstrapSessionFromShared with ensureSessionDir + autoInitSessionPin. Add autoInitSessionPin: lazily creates the _session pin when KNOWLEDGE_STORE_REMOTE env var is set and no _session pin exists. Uses sync resolveSha(source, 'HEAD') to fetch main HEAD via git ls-remote, then clonePin and mutatePins.

## Design

autoInitSessionPin(state): readPins, find SESSION_PIN_NAME, if found return. Read KNOWLEDGE_STORE_REMOTE from env, if not set return. resolveSha(source, 'HEAD'), clonePin, mutatePins to prepend. stateForSession calls ensureSessionDir then autoInitSessionPin then touchSession.

## Acceptance Criteria

New sessions start empty. If KNOWLEDGE_STORE_REMOTE is set, _session pin is auto-created with fresh main HEAD SHA. If env var not set, no auto-init — pin_set must be called explicitly. No shared pinned.yaml is copied.

