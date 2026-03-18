---
id: git-mp36
status: open
deps: []
links: []
created: 2026-03-18T20:11:03Z
type: task
priority: 1
assignee: user.email
parent: git-731r
---
# Rewrite gl-mcp-workflow.test.ts as minimal session-driven MCP E2E test

Rewrite tests/e2e/gl-mcp-workflow.test.ts to exercise the core MCP workflow with minimal setup, driven entirely by MCP tools (no CLI commands, no global pinned.yaml). The session auto-bootstrap via KNOWLEDGE_STORE_REMOTE provides the _session pin at main's HEAD SHA. All state management happens through MCP tool calls.

Flow:
1. Start MCP HTTP server with KNOWLEDGE_STORE_REMOTE=TEST_SOURCE and MCP_INSECURE=true. Connect via reference client (createClient). Session starts automatically — _session pin created at main HEAD SHA.
2. pin_set: create a named 'snapshot' pin with ref=<session SHA or 'main'> (branchless, read-only). This captures the knowledge state before modifications.
3. pin_set: assign a unique test branch to the session pin (omit pin parameter → session pin). Branch is new, so giterloper pushes it to remote at session SHA.
4. Assert: response SHA matches the session SHA from before (new branch, same commit).
5. insert_pending: push first knowledge entry to session pin (omit pin → session). Content: '# Topic A' with unique marker A.
6. Assert: response newSha differs from previous SHA (insert advances state).
7. insert_pending: push second knowledge entry to session pin. Content: '# Topic B' with unique marker B.
8. Assert: response newSha differs from insert-1 newSha.
9. reconcile_pending: reconcile on session pin (omit pin → session).
10. Assert: response newSha differs from insert-2 newSha (reconcile advances state).
11. retrieve: read the reconciled topic file from session pin. Assert content contains markers from both inserts (or at least reflects reconciliation of the two inputs). Assert effectiveSha matches reconcile newSha.
12. retrieve: read the same path from the snapshot pin (pass pin='snapshot-name'). Assert either file-not-found error or content does NOT contain the new markers. This proves snapshot isolation.

Cleanup: kill server, delete the test branch from remote via git push --delete.

## Design

Use the reference_client functions (createClient, pinSet, insertPending, reconcilePending, retrieve). The pin parameter should be omitted (or passed as undefined/empty) for session-pin operations. If the reference client TypeScript types require pin, update them to make pin optional where the MCP schema allows it.

Use randomBytes for RUN_ID and branch names to avoid collisions. Port selection should use randomPort(). Server wait via /health endpoint polling.

The test should NOT:
- Call any CLI commands (runGlJson, runGlMaintenanceJson)
- Read or write to .giterloper/pinned.yaml at the shared path
- Manually clone, stage, or promote
- Import from lib/ except what the reference client already uses

The test SHOULD:
- Use KNOWLEDGE_STORE_REMOTE env var for repo source
- Rely entirely on session auto-bootstrap for initial pin setup
- Verify SHA chain through every state-mutating operation
- Verify snapshot isolation (read-only pin sees pre-modification state)

## Acceptance Criteria

1. Test passes: deno test -A tests/e2e/gl-mcp-workflow.test.ts
2. No CLI commands used in the test (no runGlJson, runGlMaintenanceJson, runGl, or shell gl calls).
3. No reads or writes to the shared .giterloper/pinned.yaml (only session-scoped state).
4. SHA chain verified at every step: pin_set same SHA, insert-1 advances, insert-2 advances, reconcile advances, retrieve does not advance.
5. Snapshot pin retrieve proves isolation: does not reflect post-insert/reconcile content.
6. Cleanup removes the test branch from remote.
7. Test has no setup steps that manually create branches or clone repos (server and session handle all of that).

