# Giterloper MCP Server (Implemented Behavior)

This document describes how the MCP server in this repository currently works, based on the implementation in `lib/gl-mcp-server.ts` and related modules. The authoritative API contract (tool names, args, response shapes, error envelope, and error codes) is **`docs/MCP_API_CONTRACT.md`**; this file documents current server behavior and how it aligns with that contract.

It is implementation-focused: transport, auth, session behavior, tool schemas, result formats, error envelopes, and state semantics as they exist today.

## Scope and non-goals

- The server exposes giterloper knowledge operations over MCP Streamable HTTP.
- No web-research functionality is implemented; it exposes only giterloper MCP tools. It reads and mutates giterloper knowledge stores, including ingesting new client-provided content via `giterloper_insert_pending`.
- It does not expose pin lifecycle commands (`pin add`, `pin update`, `pin remove`) via MCP.

## Runtime and endpoints

- Entry point: `lib/gl-mcp-server.ts`
- Task: `deno task mcp:serve`
- Default bind: `127.0.0.1:3443` (configurable)

Environment variables:

- `MCP_HOST` (default `127.0.0.1`)
- `MCP_PORT` (default `3443`)
- `MCP_TOKEN` (Bearer token expected when secure mode is enabled)
- `MCP_INSECURE` (`true` or `1` disables auth checks; local dev only)

HTTP routes:

- `GET /health`
  - Returns:
    - `{"status":"ok","service":"giterloper-mcp","version":"1.0.0"}`
- `ALL /mcp` (`GET`, `POST`, `DELETE`, `OPTIONS` via Hono routing + CORS)
  - Protected by auth middleware
  - Handled by MCP SDK transport

## Transport and protocol usage

The server uses:

- `McpServer` from `@modelcontextprotocol/sdk`
- `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`

Important implementation detail:

- For each incoming `/mcp` request, the app creates a fresh transport and a fresh `McpServer` instance, then calls `server.connect(transport)` and `transport.handleRequest(req)`.
- Tool registrations are recreated per request by `createServer()`.

What this means in practice:

- The app itself does not maintain a custom session registry/map.
- Session protocol mechanics (including MCP session headers) are delegated to the SDK transport.
- There is no custom session persistence layer in this repository.
- Durable state is in giterloper storage (`.giterloper/` clones, staged dirs, pinned config), not in an in-memory MCP session object.

CORS configuration for MCP clients:

- Allowed request headers:
  - `Authorization`
  - `Content-Type`
  - `mcp-session-id`
  - `Last-Event-ID`
  - `mcp-protocol-version`
- Exposed response headers:
  - `mcp-session-id`
  - `mcp-protocol-version`
- Allowed methods: `GET`, `POST`, `DELETE`, `OPTIONS`

## Authentication model

Auth is enforced only on `/mcp` (not `/health`) via `mcpAuthMiddleware`.

Rules:

1. If `MCP_INSECURE=true` or `MCP_INSECURE=1`: allow all requests.
2. Else if `MCP_TOKEN` is set: require `Authorization: Bearer <token>` exact match.
3. Else: deny all MCP requests.

Unauthorized response:

- HTTP status: `401`
- Body:
  - `{"ok":false,"code":"unauthorized","message":"Authentication required","details":{}}`

## Session management (as implemented)

This repo does not implement custom session state logic. Specifically:

- No explicit create/resume/destroy session code exists in application logic.
- No in-app map keyed by `mcp-session-id`.
- No session timeout/TTL/garbage-collection policy in app code.
- No per-session authorization or role model.

Instead:

- CORS explicitly allows and exposes MCP session/protocol headers (`mcp-session-id`, `mcp-protocol-version`); protocol session handling is delegated to the SDK transport.
- Application code does not implement session mechanics and forwards MCP handling to the SDK transport.

Operational implication:

- Any operation that needs continuity relies on persisted git/pin state and repository data, not process-memory session objects.
- Tool calls are effectively stateless at app layer beyond underlying filesystem/git state.

## Server identity and capabilities

The MCP server identity passed to SDK:

- `name: "giterloper"`
- `version: "1.0.0"`

Capabilities are represented by registered tools (6 tools total).

## Tool surface (fully implemented)

All tools return JSON data encoded as text content in MCP tool responses.

### 1) `giterloper_search`

Purpose:

- Search knowledge for a pin at a specific SHA (optional override).

Input schema:

- `pin: string` (required)
- `query: string` (required)
- `sha?: string` (must match `/^[0-9a-f]{40}$/i` when provided)
- `limit?: integer` (`1..100`, default `20`)

Success payload:

- `ok: true`
- `pin: string`
- `effectiveSha: string`
- `results: Array<{ path, title, snippet, score }>`

Implementation notes:

- Uses memsearch adapter with `buildOnDemand: true`.
- Resolves pin first, then applies `sha` override if provided.

### 2) `giterloper_retrieve`

Purpose:

- Retrieve file content at pin + SHA.

Input schema:

- `pin: string` (required)
- `path: string` (required; relative path within knowledge store, e.g. `knowledge/foo.md`)
- `sha?: string` (40-char hex when provided)

Validation semantics:

- If `path` is missing or empty:
  - returns `invalid_argument` envelope

Success payload:

- `ok: true`
- `pin: string`
- `effectiveSha: string`
- `path: string`
- `content: string`

### 3) `giterloper_insert_pending`

Purpose:

- Queue markdown into `knowledge/_pending/` and push to remote branch.

Input schema:

- `pin: string` (required)
- `content: string` (required)
- `name?: string` (optional filename hint)

Validation semantics:

- `content` is trimmed; empty/whitespace-only content is rejected with:
  - `{"ok":false,"code":"invalid_argument","message":"content must be non-empty","details":{}}`

Behavior details:

- Requires pin with `branch` (branchless write is rejected).
- Ensures working clone via `ensureWorkingClone` (which runs `assertBranchReadyForWrite`: remote must be reachable, pin SHA must match remote branch HEAD or branch may be absent on remote), then `assertBranchFresh` before write.
- Chooses filename via `makeQueueFilename`.
- If filename already exists, appends deterministic short hash suffix based on content.
- Writes file (ensures trailing newline), commits if dirty, pushes branch, updates pin SHA.

Success payload:

- `ok: true`
- `action: "inserted"`
- `pin: string`
- `branch: string`
- `file: string` (basename written)
- `oldSha: string`
- `newSha: string`

### 4) `giterloper_reconcile_pending`

Purpose:

- Process `knowledge/_pending/` into knowledge topic files; push and update pin SHA only when reconcile actually changes files.

Input schema:

- `pin: string` (required)

Behavior details:

- Requires branch pin.
- Ensures working clone via `ensureWorkingClone` (which runs `assertBranchReadyForWrite`: remote must be reachable, pin SHA must match remote branch HEAD or branch may be absent on remote), then `assertBranchFresh` before mutating.
- Pending files are processed in commit order (earliest add first); entries with addEpoch 0 are included and ordered last, not skipped.
- Calls `reconcile(dir)`.
- If reconcile reports unresolved issues, returns:
  - `ok: false`
  - `code: "invalid_argument"`
  - `message: <reconcile message>`
  - `details.unresolved: string[]`
- Push and pin SHA update happen only when `result.touched.length > 0` or `result.deleted.length > 0`; a no-op reconcile does not push or update pin SHA.

Success payload:

- `ok: true`
- `action: "reconciled"`
- `pin`, `branch`
- `oldSha`, `newSha`
- `touched: string[]`
- `deleted: string[]`
- `unresolved: string[]`

### 5) `giterloper_reconcile`

Purpose:

- Merge source pin branch into target pin branch remotely (GitHub merge API path).

Input schema:

- `sourcePin: string` (required)
- `targetPin: string` (required)

Behavior details:

- Both pins must have branches.
- Source and target must point to same repo source.
- Source must be GitHub (`parseGithubSource` must succeed).
- Performs remote merge, then updates target pin SHA.

Success payload:

- `ok: true`
- `action: "merged"`
- `source: { pin, branch, sha }`
- `target: { pin, branch, oldSha, newSha }`

### 6) `giterloper_state_inspect`

Purpose:

- List pins and optionally run clone/freshness checks.

Input schema:

- `pin?: string` (if omitted, all pins)
- `verify?: boolean` (default `false`)

Success payload (list mode, `verify=false`):

- `ok: true`
- `pins: Array<{ name, source, sha, branch | null }>`

Success payload (verify mode, `verify=true`):

- `ok: true`
- `checks: Array<{ pin, branch, sha, clonePresent, cloneShaOk, workingCloneExists, branchFresh }>`  
  - `branchFresh` is `boolean | null`.
- When `pin` is omitted and there are no pins in the system: returns `{ ok: true, pins: [] }` with no `checks` array.
- When `pin` is provided but names a non-existent pin: returns an error envelope `{ ok: false, code: "missing_pin", ... }` with `isError: true` (thrown by `resolvePin`).

## Wire format of tool results

Tool handlers are wrapped by `wrapTool`:

- On success (handler returns a value without throwing):
  - MCP result has `content: [{ type: "text", text: "<JSON string>" }]`
  - `text` is JSON string of the success object (or of a returned error envelope; see below).
- On failure via thrown exception:
  - Error is mapped via `mapErrorToMcp(error)`
  - MCP result has `isError: true`
  - Content format remains text JSON: `content: [{ type: "text", text: "<JSON error envelope>" }]`
- Some validation and business-rule failures do not throw: the handler returns `{ ok: false, code: "invalid_argument", ... }` (or similar) as a normal result, so `isError` is not set. The same text JSON shape is used.

Practical client expectation:

- Parse `content[0].text` as JSON for every tool result.
- Treat the response as failed if **either** `isError === true` **or** the parsed payload has `ok === false`.

## Error envelopes and mapping

Canonical error envelope shape:

- `ok: false`
- `code: string`
- `message: string`
- `details: object`

Error code sources (not all from the same layer):

- **Auth middleware** (before tool execution): `unauthorized` — returned as HTTP 401 with the envelope above when auth fails.
- **Tool handlers (direct return)**: `invalid_argument` — returned in tool result content (no throw, so no `isError`) for input or business-rule validation (e.g. empty insert content, missing path for retrieve, unresolved reconcile).
- **`mapErrorToMcp()` (thrown exceptions)**: `missing_pin`, `stale_index`, `mismatched_sha`, `branchless_write`, `reconciliation_conflict`, `external`. Implemented in `lib/mcp-error-mapping.ts`; `StaleIndexError` maps to `stale_index` with `details.expectedPinName` and `details.expectedSha`; `GlError` and generic errors are pattern-matched by message text; unknown/unmatched map to `external`. Remote unreachable during the write-path checks (e.g. "could not reach remote to verify pin vs branch HEAD" or "could not reach remote to check branch freshness") is not pattern-matched and thus maps to `external`.

Note on HTTP status mapping:

- `mcpCodeToHttpStatus()` exists and maps codes to HTTP statuses.
- In the current MCP tool flow, those statuses are not sent as HTTP response status for tool calls; tool failures are conveyed in the tool result (either `isError: true` with envelope in content, or normal result with `ok: false` in content).
- The only explicit HTTP error status emitted by route middleware is `401` for auth failures.

## State/version semantics

Read tools that support versioning (`giterloper_search`, `giterloper_retrieve`):

- `sha` is optional.
- Effective SHA is: the provided `sha` argument, or else the pin head SHA from `.giterloper/pinned.yaml`.
- Success responses include `effectiveSha`. (`giterloper_state_inspect` does not take or return `sha`/`effectiveSha`.)

Write tools:

- Operate on branch-backed pin head state. Local-clone writes (`insert_pending`, `reconcile_pending`) enforce working clone and branch freshness; `giterloper_reconcile` performs a remote merge and does not use local clone freshness checks. If the remote cannot be reached during the ready-for-write or freshness checks, the operation fails with code `external`.
- Success responses include transition identifiers: `oldSha` and `newSha`. For `giterloper_reconcile` these are under `target.oldSha` and `target.newSha`; for the other write tools they are top-level.
- Server updates pin SHA after successful write/merge. For `giterloper_reconcile_pending`, the pin SHA is updated only when the reconcile actually touched or deleted files.

## Read/write classification

In `lib/mcp-auth.ts`, tools are classified:

Read tools:

- `giterloper_search`
- `giterloper_retrieve`
- `giterloper_state_inspect`

Write tools:

- `giterloper_insert_pending`
- `giterloper_reconcile`
- `giterloper_reconcile_pending`

Current auth behavior does not yet apply distinct read/write policy; this classification is available for policy extension.

## Concurrency and consistency behaviors

- Local-clone write tools (`giterloper_insert_pending`, `giterloper_reconcile_pending`) first call `ensureWorkingClone` (which uses `assertBranchReadyForWrite` to ensure the remote is reachable and pin SHA matches remote branch HEAD or the branch is not on remote yet), then `assertBranchFresh` before mutation. If the remote is unreachable in either step, the tool fails with code `external`. This is not applied to `giterloper_reconcile`, which performs a remote merge via the GitHub API.
- Pin SHA updates and clone lifecycle are coordinated through existing giterloper internals (`updatePinSha`, clone verification, working clone management).
- Memsearch calls include pin+sha context and can rebuild on demand; stale index mismatches map to explicit errors.

## What is not implemented (protocol/application level)

- No stdio MCP transport.
- No custom SSE endpoint in app code; MCP is handled through SDK streamable HTTP on `/mcp`.
- No app-defined session lifecycle APIs or persistence.
- No MCP tool for pin lifecycle management.

## Quick local run

From the repository root:

```bash
MCP_INSECURE=true deno task mcp:serve
```

Or equivalently: `MCP_INSECURE=true deno run -A lib/gl-mcp-server.ts`

Token-secure run:

```bash
MCP_TOKEN=your_token deno task mcp:serve
```

Then connect an MCP Streamable HTTP client to:

- `http://127.0.0.1:3443/mcp`
