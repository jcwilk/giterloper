---
id: git-hlse
status: closed
deps: []
links: []
created: 2026-03-22T06:06:55Z
type: task
priority: 2
assignee: user.email
---
# MCP: cover state_inspect observability when pins array is empty

Normative: specs/MCP.md Observability — successful giterloper_state_inspect results MUST include mcpTestMode and configuredKnowledgeStoreRemote even when pins is empty (explicit parenthetical in that section).

Gap: tests/mcp/mcp-observability.test.ts only asserts observability when _session exists after bootstrap. No case exercises the empty-pins success branch.

Add an integration test (HTTP MCP via createMcpAppForTest) that initializes a session with knowledgeStoreRemote: null (harness skip-bootstrap), calls giterloper_state_inspect with {}, parses tool JSON, and asserts ok true, pins length 0, and inspect.mcpTestMode / inspect.configuredKnowledgeStoreRemote match GET /health for the same app instance. Aligns CI with specs/MCP.md §Observability empty-pin wording.

## Acceptance Criteria

deno test -A tests/mcp/mcp-observability.test.ts passes; new case documents empty-pin observability per specs/MCP.md; no spec edits required.

