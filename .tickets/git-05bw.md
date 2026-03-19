---
id: git-05bw
status: open
deps: []
links: []
created: 2026-03-19T02:54:32Z
type: task
priority: 1
assignee: user.email
parent: git-3yyh
---
# Revise tests that mention global pinned.yaml

Delete or revise all non-historical references from #3: tests/e2e/gl-branching.test.ts skip comments and reference_client/tests/client.test.ts skip comments currently mention 'global pinned.yaml'. Reword skip reasons so they do not mention global/shared/sessionless pinned.yaml at all while preserving test intent and current skip status.

## Design

Do not change behavioral scope of these tests in this ticket; this is wording cleanup only. Keep rationale focused on session-first model and MCP-driven workflow where needed. Ensure phrasing does not retain synonyms like shared/global/sessionless pinned.yaml.

## Acceptance Criteria

No remaining 'global pinned.yaml' or equivalent wording in tests/e2e/gl-branching.test.ts and reference_client/tests/client.test.ts. Tests still compile/parse and maintain intended skip behavior.

