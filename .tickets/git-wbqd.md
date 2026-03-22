---
id: git-wbqd
status: closed
deps: [git-kmr7]
links: []
created: 2026-03-22T02:43:33Z
type: task
priority: 2
assignee: user.email
parent: git-amyx
---
# Tests: align core and MCP harness to new MCP pin/bootstrap contract

Update tests that assume optional KNOWLEDGE_STORE_REMOTE, empty initial pins on MCP, or client source on pin_set. Keep CLI tests valid. Cite specs/MCP.md and specs/core.md as authority.

**Boundary vs `git-jkpb`:** harness-level test mode defaults and **`tests/README.md`** for **`.giterloper_test`** land in **`git-jkpb`**; this ticket updates **product-behavior assertions** and scenarios for the pin/bootstrap contract.

## Acceptance Criteria

deno task test (or targeted manifests) passes; new or updated cases cover startup failure, session bootstrap, and pin_set without source where MCP is exercised.


## Notes

**2026-03-22T03:54:57Z**

Added MCP integration test pin_set rejects source argument (specs/core.md, MCP.md). Regenerated tests/test-case-manifest.json. check_all.sh green.
