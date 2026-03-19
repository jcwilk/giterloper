---
id: git-e805
status: closed
deps: []
links: []
created: 2026-03-18T23:02:01Z
type: task
priority: 2
assignee: user.email
parent: git-tsxe
---
# Update docs and skills to session-only model

Remove documentation that describes a single repo-wide pin file; the only mutable state model is session-scoped under `.giterloper/sessions/<sessionId>/`. CLI defaults to `_cli` session with `--session-id` override.

Files to update:
- README.md line 13: 'Store connections are defined in .giterloper/pinned.yaml' — rewrite to describe session-scoped state. Line 19: update paths description.
- AGENTS.md line 54: 'pinned.yaml locking' section — update (FIFO lock removed for pinned.yaml). Lines 66-81: pinned.yaml format section — note session-rooted location. Mention CLI defaults to _cli session and accepts --session-id.
- tests/README.md lines 44, 74-79: replace cross-test local state wording and any pin path that omits `sessions/<id>/` — rewrite for session-isolated model.
- docs/DEPLOYMENT_REQUIREMENTS.md lines 11-13: Layout section mentions shared .giterloper/ alongside sessions. Simplify to session-only layout.
- docs/FLY_IO_DEPLOYMENT.md: Minor language update if needed (sessions dir lives under .giterloper/ which is still on the volume).
- docs/PIN_SET_CONTRACT.md line 33: simplify copy/bootstrap wording (session-only model is universal now).
- .cursor/skills/gl/SKILL.md lines 3, 13, 17: .giterloper/pinned.yaml references — update to session-scoped paths and mention --session-id.
- .cursor/skills/mcp-access/SKILL.md line 31: 'Do not edit .giterloper/pinned.yaml directly' — update path reference.
- scripts/run-docker.sh: update comment if needed (volume mount is fine, sessions dir lives inside .giterloper/).
- lib/locking.ts line 2 JSDoc: 'FIFO lock for coordinated access to shared resources' — update if lock is kept.

## Acceptance Criteria

No documentation or skill file describes a repo-wide pin file outside `sessions/<id>/` as a runtime concept. CLI `--session-id` usage is documented in AGENTS.md and SKILL.md. tests/README.md describes session-isolated E2E model.

