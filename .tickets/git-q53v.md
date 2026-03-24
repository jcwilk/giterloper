---
id: git-q53v
status: open
deps: [git-zug8]
links: []
created: 2026-03-24T16:00:09Z
type: chore
priority: 3
assignee: user.email
parent: git-vsoz
---
# Optional: allowlist CI check for specs/*.md path creep

Lightweight grep-based check (e.g. scripts/check_all.sh) flagging new specs/foo.md literals outside allowlist (AGENTS, mandate pairing examples if kept, verifier, tests/README table, specs/*.md cross-links, specs/README hub). Tune allowlist after main decoupling. Skip if maintainers judge too brittle.

## Acceptance Criteria

**Mandatory closure artifact:** either (1) merged guardrail in scripts/check_all.sh (or equivalent) with documented allowlist and green `./scripts/check_all.sh`, or (2) ticket closed **deferred** with a **≥2 sentence rationale** copied or summarized on epic git-vsoz (no silent skip). Allowlist must include verifier, specs/*.md cross-links, tests/README pairing table, specs/README hub, and ticket-slice citations per git-zug8.

