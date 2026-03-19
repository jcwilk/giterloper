---
id: git-5lt8
status: closed
deps: [git-69p7]
links: []
created: 2026-03-17T06:12:07Z
type: task
priority: 1
assignee: user.email
parent: git-amoh
---
# Update all MCP tool descriptions to session pin terminology

Update description strings for all MCP tools in gl-mcp-server.ts (search, retrieve, insert_pending, reconcile_pending, merge, state_inspect, pin_set, session_end). Replace 'session default' / 'default pin' with 'session pin'. Add 'Omit pin to target the session pin.' to tools with optional pin parameter. These tools already get the new resolution behavior via resolvePin — only their user-facing descriptions need updating.

## Acceptance Criteria

All tool descriptions reference 'session pin' not 'default pin'. No tool description mentions 'default' in the old sense. Tools with optional pin say 'Omit pin to target the session pin.'

