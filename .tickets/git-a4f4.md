---
id: git-a4f4
status: open
deps: []
links: []
created: 2026-03-22T02:43:33Z
type: task
priority: 0
assignee: user.email
parent: git-amyx
---
# MCP: fail fast at startup when KNOWLEDGE_STORE_REMOTE missing

Normative: specs/MCP.md § Knowledge store configuration — KNOWLEDGE_STORE_REMOTE MUST be set before serving; unset/empty/invalid → immediate non-zero exit, stderr message; no listen, no lazy first-tool failure.

## Design

Touch HTTP and stdio MCP entrypoints (and Docker/cmd if they start the server without env). Reuse or add a single validation helper used by both transports. Invalid URL forms should fail the same way.

## Acceptance Criteria

Starting the MCP server with **`KNOWLEDGE_STORE_REMOTE` unset, empty, or invalid** exits non-zero with a clear stderr message before serving. With it set to a valid remote, server starts as today. Operator-facing doc updates are tracked in **`git-nh06`** (not in-scope for closing this ticket).

