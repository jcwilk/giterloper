---
id: git-731r
status: closed
deps: []
links: []
created: 2026-03-18T20:10:27Z
type: epic
priority: 1
assignee: user.email
---
# Epic: Test suite alignment and trimming

Align the test suite with session-first architecture truths: (1) no shared/global pinned.yaml, (2) session pin starts at main's fresh SHA, (3) KNOWLEDGE_STORE_REMOTE is the source of truth for repo. Trim tests that will definitely need updating during final polish. Rewrite the MCP workflow E2E test to be session-driven with minimal setup. Skip or remove CLI E2E and reference client tests that operate on the global pinned.yaml.

