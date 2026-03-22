---
id: git-xl5q
status: closed
deps: [git-aj33]
links: []
created: 2026-03-21T21:18:08Z
type: chore
priority: 3
assignee: user.email
parent: git-0kbo
---
# Docs: retry log location and semantics (logs/)

Add short note to AGENTS.md and/or tests/README.md: under load retry attempts append to logs/ (path, fields: timestamp, pid, sessionId, operation, attempts, waitMs); stderr only if log write fails. Point to plan .cursor/plans/centralized_external_retries_8c5f6622.plan.md or epic git-0kbo for detail. No MCP JSON error schema change unless explicitly approved later.

## Acceptance Criteria

Docs merged; no normative contradiction with MCP.md or PIN_SETTING_PARAM_BEHAVIOR.md.

