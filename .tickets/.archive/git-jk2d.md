---
id: git-jk2d
status: closed
deps: [git-9bqz]
links: []
created: 2026-03-16T00:22:05Z
type: task
priority: 1
assignee: user.email
parent: git-6wkq
---
# Session-aware GlState and path roots

Extend GlState and path helpers to thread sessionId and resolve all MCP mutable paths under .giterloper/sessions/<sessionId> (pinned.yaml, versions, staged, indexes). Update lib/paths.ts and lib/gl-core.ts accordingly.

## Acceptance Criteria

State creation requires/resolves sessionId and all targeted mutable MCP paths are session-rooted with no shared-path escape.

