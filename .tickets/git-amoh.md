---
id: git-amoh
status: open
deps: []
links: []
created: 2026-03-17T06:11:26Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Rewrite session pin as _session with name-based resolution

Replace the broken default pin concept (RESERVED_PIN_NAME=default, position-based pins[0]) with a literal _session pin resolved by name. Remove shared pinned.yaml bootstrap for both CLI and MCP. Add KNOWLEDGE_STORE_REMOTE env var for auto-init. The name _session is reserved at the API surface — tools access the session pin by omitting the pin parameter.

