---
id: git-mowe
status: open
deps: []
links: []
created: 2026-03-14T19:02:14Z
type: epic
priority: 0
assignee: user.email
---
# Epic: MCP knowledge server + per-version search

Implement the USE_CASES target architecture: giterloper as an HTTP/SSE MCP server that external agents use for version-pinned retrieval, pending-knowledge intake, and reconciliation, with memsearch-backed indexing isolated per pin+sha and a minimal external reference client. Include robust E2E coverage against github.com/jcwilk/giterloper_test_knowledge and eliminate stale index-related references in existing code/docs.

