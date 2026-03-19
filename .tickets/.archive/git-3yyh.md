---
id: git-3yyh
status: closed
deps: []
links: []
created: 2026-03-19T02:54:32Z
type: epic
priority: 1
assignee: user.email
---
# Epic: Remove non-historical shared pinned.yaml references

Enforce a strict repository rule: outside historical artifacts (closed tickets/archive metadata) and git history, there must be zero references to any global/shared/sessionless pinned.yaml concept. Canonical behavior is session-scoped state only under .giterloper/sessions/<sessionId>/pinned.yaml.

## Design

Authoritative contract precedence applies: docs/PIN_SETTING_PARAM_BEHAVIOR.md and docs/PIN_SET_CONTRACT.md (plus AGENTS.md guidance) define session-scoped pin behavior. Tests and docs must align; stale references to global/shared/sessionless pinned.yaml should be deleted or rewritten to session-scoped wording.

## Acceptance Criteria

All child tickets close with evidence. Final sweep ticket confirms zero non-historical references to global/shared/sessionless pinned.yaml outside allowed exclusions.

