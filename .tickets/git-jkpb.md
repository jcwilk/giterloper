---
id: git-jkpb
status: closed
deps: [git-nyh6]
links: []
created: 2026-03-22T03:10:24Z
type: task
priority: 1
assignee: user.email
parent: git-t6y7
---
# Harness: universal test mode + README + suite hygiene for .giterloper_test

Central test helpers (tests/helpers/*) MUST set MCP test mode and TEST_KNOWLEDGE_STORE_REMOTE (or explicit createServer options) for every MCP spawn and any gl/CLI path that writes session state during integration tests, so no case accidentally uses .giterloper with the shared test repo. Unified runner: delete repo-root .giterloper_test at suite start (mirror .giterloper hygiene). Update tests/README.md: document **`GITERLOPER_MCP_TEST_MODE`**, **`TEST_KNOWLEDGE_STORE_REMOTE`**, **`.giterloper_test`**, and the requirement that integration helpers force MCP test mode for all MCP + CLI subprocesses that write session state.

**Boundary vs `git-wbqd`:** this ticket owns **harness defaults, README, and `.giterloper_test` suite hygiene**; **`git-wbqd`** owns broader scenario/assertion updates for the **`git-amyx`** pin contract (empty pins, client `source`, etc.) after **`git-kmr7`**.

## Acceptance Criteria

tests/README.md updated. Grep-driven audit: integration entrypoints use shared helper or documented pattern. Full deno task test passes after prior children land.

