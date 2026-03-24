---
id: git-eppg
status: open
deps: [git-zug8, git-1dih]
links: []
created: 2026-03-24T16:00:09Z
type: task
priority: 1
assignee: user.email
parent: git-vsoz
---
# Trim repeated concrete spec paths in AGENTS outside hub

Keep 'Where to read contracts' and explicit pairing paragraphs with concrete paths (AGENTS exception). Replace other operational mentions (memsearch, MCP server, env) with slice labels or 'see Where to read contracts' / specs hub link to avoid N duplicate inline paths.

## Acceptance Criteria

AGENTS.md contains **zero** markdown links or backticked literals matching `specs/<name>.md` **outside** these allowlisted regions: the **Where to read contracts** navigational block, the **pairing** paragraphs that bind CLI help and MCP strings to slice specs, and any verbatim table row text required for verifier alignment. Replacements use slice labels, `specs/` directory references, or links to **specs/README.md** (hub). Pairing obligations remain explicit and unchanged in meaning. Human-readable.

