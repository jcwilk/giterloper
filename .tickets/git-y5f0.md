---
id: git-y5f0
status: open
deps: []
links: []
created: 2026-03-22T03:10:24Z
type: task
priority: 0
assignee: user.email
parent: git-t6y7
---
# Core: session roots + effective knowledge remote by MCP test mode

Normative: specs/core.md session layout; specs/MCP.md modes and env table. Add constants for .giterloper and .giterloper_test; single resolver used by makeState, mcp-session-store (sessionDir/scavenge/removeSessionData/touch), and any other path helper that joins projectRoot + session base. Implement mcpTestMode from GITERLOPER_MCP_TEST_MODE (+ document in-process override hook for createServer). effectiveKnowledgeStoreRemote: normal → KNOWLEDGE_STORE_REMOTE / override; test → TEST_KNOWLEDGE_STORE_REMOTE / override. autoInitSessionPin and CLI makeState paths must use the same base when test mode is on so gl subprocesses match MCP.

## Design

Prefer lib/gl-core.ts or a small new module imported by gl-core, mcp-session-store, gl.ts. Avoid duplicating path.join logic.

## Acceptance Criteria

Unit-level tests in tests/core/ (or minimal) prove base dir flips with test mode; no env var renames the literal folder strings. Typecheck clean. Behavior MUST match **`specs/MCP.md`** and **`specs/core.md`** as committed with this planning bundle (no silent spec drift).

