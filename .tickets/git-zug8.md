---
id: git-zug8
status: open
deps: []
links: []
created: 2026-03-24T16:00:09Z
type: task
priority: 0
assignee: user.email
parent: git-vsoz
---
# Policy: spec path literals (tiers) in AGENTS and mandate

Author explicit repo policy for when concrete specs/<name>.md paths are required vs discouraged, aligned with existing AGENTS 'Examples in instruction text' and verifier needs. Cover tiers, for example: (a) allowlisted hubs—'Where to read contracts', pairing bullets, verifier slice table (`/.cursor/agents/verifier.md`), tests/README pairing table, and (after git-1dih) specs/README.md hub; (b) area specs may keep precise cross-links and deferrals to sibling slice files; (c) process-oriented markdown (AGENTS-linked skills under `.cursor/skills/`, mandate prose, generic lib/docs/root README comments) uses slice labels or `specs/` without enumerating real basenames unless the text is literally about that exact file. Explicitly reserve: **ticket bodies**, **verifier consultation**, and **file-tickets / work-next citations** may keep concrete `specs/<file>.md` paths where they anchor alignment work (consistent with pairing obligations).

## Acceptance Criteria

AGENTS.md includes a concise 'Spec path literals' (or equivalent) subsection stating the tier rules without contradicting pairing rules (CLI help ↔ CLI slice spec, MCP tool strings ↔ MCP slice spec). HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md: the **§1 illustrative pairing sentence** that lists four real `specs/*.md` basenames as examples of area specs uses placeholders like `specs/<slice>.md` where the point is the general hierarchy (per AGENTS); do not rewrite other mandate sections that are already slice-generic unless they still enumerate real basenames. Verifier slice table stays concrete. Close note: one-line confirmation that `.cursor/skills/*.md` were scanned for tier (c) compliance (expect mostly `specs/*` placeholders already). Policy is actionable for downstream tickets.

