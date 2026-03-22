---
id: git-nh06
status: open
deps: [git-a4f4, git-6lq1]
links: []
created: 2026-03-22T02:43:33Z
type: chore
priority: 3
assignee: user.email
parent: git-amyx
---
# docs: operator notes for mandatory KNOWLEDGE_STORE_REMOTE and MCP bootstrap

docs/ MUST NOT contradict specs/MCP.md (AGENTS deployment notes if they describe MCP env). Update Fly/docker/local run docs so operators set **`KNOWLEDGE_STORE_REMOTE`** for normal MCP. Document **`GITERLOPER_MCP_TEST_MODE`** + **`TEST_KNOWLEDGE_STORE_REMOTE`** for harness/automation only (session root **`.giterloper_test`**).

## Acceptance Criteria

- Docs state **`KNOWLEDGE_STORE_REMOTE`** is **required** for normal MCP server operation; no wording that it is optional for MCP in production/dev defaults.
- Docs briefly describe that new MCP sessions **bootstrap `_session`** from the effective configured remote (default branch HEAD), consistent with **`specs/MCP.md`** — implement after **`git-6lq1`** lands so examples match behavior.
- Docs mention test-mode env pair (**`GITERLOPER_MCP_TEST_MODE`**, **`TEST_KNOWLEDGE_STORE_REMOTE`**) where operators run MCP-like test stacks, without contradicting **`tests/README.md`**.

