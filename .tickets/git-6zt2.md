---
id: git-6zt2
status: closed
deps: [git-69p7, git-5lt8, git-5a2z]
links: []
created: 2026-03-17T06:12:27Z
type: task
priority: 2
assignee: user.email
parent: git-amoh
---
# Update docs: AGENTS.md, reference_client/README.md, skill files for session pin

Update AGENTS.md: rename pin_set semantics section to use 'session pin (_session)', document KNOWLEDGE_STORE_REMOTE env var, update MCP server section, update pinned.yaml format section. Update reference_client/README.md: update pin_set description in tools table. Update skill files and any other docs that reference 'default pin' or 'session default' to use 'session pin (_session)'.

## Acceptance Criteria

No doc mentions 'default pin' in the old sense. AGENTS.md documents KNOWLEDGE_STORE_REMOTE. All docs use 'session pin' terminology consistently. pinned.yaml format section shows _session pin.

