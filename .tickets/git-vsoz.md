---
id: git-vsoz
status: open
deps: []
links: []
created: 2026-03-24T15:59:56Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Decouple non-hub surfaces from concrete specs/*.md paths

Commit f3f7af7 renamed specs/MCP.md to specs/mcp.md and required 27 files of mechanical path edits. That churn violates the spirit of AGENTS.md 'Examples in instruction text' (generic prose/comments should not use real specs/*.md as stand-ins for normative docs). Goal: lean documentation—slice labels and a few canonical hubs—without breaking hierarchical truth, verifier slice maps, tests/README pairing table, or AGENTS pairing of CLI help and MCP tool strings with their slice specs. Scope: all area specs under specs/, not only MCP.

**Preflight (cross-critique):** `.cursor/skills/*.md` largely already use generic `specs/*` placeholders; git-zug8 close note should still record a quick scan. No `CONTRIBUTING.md` in repo; CI is shell-driven (`scripts/check_all.sh`). Optional git-q53v allowlist should respect verifier + specs cross-links exemptions.

