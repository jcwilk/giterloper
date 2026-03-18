---
id: git-tsxe
status: open
deps: []
links: []
created: 2026-03-18T23:00:44Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Sessionize CLI — remove shared/global pinned.yaml

Remove the shared/global .giterloper/pinned.yaml concept entirely. CLI tools (gl and gl-maintenance) default to reserved session id _cli with optional --session-id override. makeState() signature becomes makeState(sessionId: string) with no non-session code path. MCP code is completely untouched. All docs, tests, and code aligned to session-only model. See .cursor/plans/sessionize_cli_state_cb6cc069.plan.md

