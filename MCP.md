# Giterloper MCP Server (Implemented Behavior)

This document describes how the MCP server in this repository currently works, based on the implementation in `lib/gl-mcp-server.ts` and related modules. It is the authoritative description of the API contract (tool names, args, response shapes, error envelope, and error codes) and current server behavior.

It is implementation-focused: transport, auth, session behavior, tool schemas, result formats, error envelopes, and state semantics as they exist today.

## Scope and non-goals

- The server exposes giterloper knowledge operations over MCP via **HTTP/SSE** (Streamable HTTP) or **stdio**.
- No web-research functionality is implemented; it exposes only giterloper MCP tools. It reads and mutates giterloper knowledge stores, including ingesting new client-provided content via `giterloper_insert_pending`.
- It does not expose pin lifecycle commands (`pin add`, `pin update`, `pin remove`) via MCP.

## Dual-transport parity

One implementation of all MCP behavior (tools, session semantics, error mapping) is shared; only the transport and session-id source differ.

**Must stay identical across transports:**

- Tool names, input/output schemas, and result/error shapes.
- Session semantics: per-session state under `.giterloper/sessions/<sessionId>/`, bootstrap from shared, `giterloper_session_end` behavior.
- Error envelope and codes (see "Error envelopes and mapping" below).

**Transport-specific by design:**

- **HTTP:** Session id from SDK `sessionIdGenerator`; returned in `mcp-session-id` header; auth via `MCP_TOKEN`; `GET /health`, CORS.
- **Stdio:** Single process-scoped session id (injected via `createServer({ getSessionId })`); no auth; no `/health`; all logging to stderr. See [docs/STDIO_TRANSPORT_SPIKE.md](./docs/STDIO_TRANSPORT_SPIKE.md).

When adding or changing tools or session behavior, update the shared core only; both transports stay in parity.

## Runtime and endpoints

**HTTP (default):**

- Entry point: `lib/gl-mcp-server.ts`
- Task: `deno task mcp:serve` (native; default for development)
- Default bind: `127.0.0.1:3443` (configurable)
- Production and optional local Docker run: see [docs/FLY_IO_DEPLOYMENT.md](./docs/FLY_IO_DEPLOYMENT.md)

**Stdio:**

- Entry point: `lib/gl-mcp-server-stdio.ts`
- Task: `deno task mcp:serve-stdio`
- One session per process; session id fixed at startup. Use for local subprocess clients (e.g. IDE integrations).

Environment variables:

- `MCP_HOST` (default `127.0.0.1`)
- `MCP_PORT` (default `3443`)
- `MCP_TOKEN` (Bearer token expected when secure mode is enabled)
- `MCP_INSECURE` (`true` or `1` disables auth checks; local dev only)
- `MCP_SESSION_TTL_MS` (stale session scavenge TTL in ms; default 86400000 = 24h; 0 disables). When TTL > 0, scavenging runs periodically at an interval of `min(TTL/4, 15 * 60 * 1000)` ms.

HTTP routes:

- `GET /health`
  - Returns:
    - `{"status":"ok","service":"giterloper-mcp","version":"1.0.0"}`
- `ALL /mcp` (`GET`, `POST`, `DELETE`, `OPTIONS` via Hono routing + CORS)
  - Protected by auth middleware
  - Handled by MCP SDK transport
  - **DELETE /mcp:** Client should send `mcp-session-id` header. The server removes that session's disk state (`.giterloper/sessions/<sessionId>/`) then forwards the request to the transport. Same effect as calling the `giterloper_session_end` tool; does not invalidate the in-memory protocol session in the SDK.

## Transport and protocol usage

The server uses:

- `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
- `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`

Important implementation detail:

- A **single long-lived** transport and `McpServer` instance serve all `/mcp` requests. The transport is created with `sessionIdGenerator: () => randomUUID()` so that `initialize` returns an `mcp-session-id` and the SDK maintains in-memory session state.
- Each request is handled by `mcpTransport.handleRequest(c.req.raw)`; tool registrations live on the shared server from `createServer()`.

What this means in practice:

- Session protocol mechanics (including MCP session headers and session lookup) are delegated to the SDK transport.
- **Per-call state:** Every tool resolves `GlState` via `stateForSession(extra)` using `extra.sessionId` from the SDK. A valid `sessionId` is required; missing or invalid `sessionId` leads to failure (e.g. 400/404 before the tool runs, or STATE-style error in validation). Session ids are validated with `validateSessionId`: non-empty, allowed characters `a-z`, `A-Z`, `0-9`, `_`, `-`, max length 128 (path safety).
- **Session path layout:** When `sessionId` is set, mutable paths root under `.giterloper/sessions/<sessionId>/` (e.g. `pinned.yaml`, `versions/`, `staged/`, indexes). This comes from `makeState(sessionId)` in `lib/gl-core.ts`.
- **Bootstrap from shared:** When a session directory exists but is empty, the server copies shared `pinned.yaml` and existing version clones from `.giterloper/versions/` into the session's `versions/` so search/retrieve work without re-cloning. Done in `bootstrapSessionFromShared(state)` before each tool's state use.
- Durable shared state remains in giterloper storage (`.giterloper/pinned.yaml`, shared clones when not session-scoped).

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

The server uses the SDK transport in **stateful mode** with `sessionIdGenerator`:

- **Initialize** returns an `mcp-session-id` response header; clients MUST include this header on all subsequent requests.
- **Tool calls without a valid session** (missing or invalid `mcp-session-id`) fail with HTTP **400** when the session header is missing or not initialized (e.g. "Mcp-Session-Id header is required") and **404** when the provided session id is unknown or invalid (e.g. "Session not found").
- **Session reuse** via `mcp-session-id` header is supported; the transport maintains in-memory session state.

A single long-lived transport and server instance serve all requests; session state is maintained in-memory by the SDK transport. Session-local disk state (`.giterloper/sessions/<sessionId>/`) is managed by `lib/mcp-session-store.ts` with explicit cleanup via `giterloper_session_end` or `DELETE /mcp` (with `mcp-session-id` header). Both remove only session disk state; they do not invalidate the in-memory protocol session in the SDK. Stale-session scavenging is **inactivity-based**: when `MCP_SESSION_TTL_MS` > 0, sessions whose last activity is older than the TTL are removed. Last activity is updated on each tool call (via `touchSession` in `stateForSession`). Scavenging runs at an interval derived from the TTL (see "Runtime and endpoints" for the formula). Per-session authorization is not implemented.

Operational implication:

- Clients must call `initialize` first, capture the `mcp-session-id` from the response, and send it on all subsequent tool/list/other requests.
- Any operation that needs continuity relies on the protocol session plus persisted git/pin state and repository data.

## Pin parameters and session default

- **Default pin:** When a tool's `pin` (or `sourcePin`/`targetPin`) is omitted, the effective pin is the **first entry** in the effective pinned list (session-scoped `.giterloper/sessions/<sessionId>/pinned.yaml` or shared `.giterloper/pinned.yaml`). This is implemented by `resolvePin(state, undefined)` in `lib/pinned.ts`.
- **Reserved name "default":** The pin name `"default"` is reserved system-wide (CLI and MCP). Any tool that accepts a pin argument (e.g. `pin`, `sourcePin`, `targetPin`) rejects the explicit value `"default"` with `invalid_argument`; clients must omit the argument to use the session default. See "Error envelopes and mapping" for `RESERVED_PIN` pattern in `mapErrorToMcp`.
- **Session-scoped writes:** When state is session-scoped (`sessionId` set), `mutatePins` writes directly to the session's `pinned.yaml` and **skips the shared FIFO lock** (`.giterloper/locks/pins`); there is no cross-process contention for session-local pin mutations.

## Server identity and capabilities

The MCP server identity passed to SDK:

- `name: "giterloper"`
- `version: "1.0.0"`

Capabilities are represented by registered tools (8 tools total).

## Tool surface (fully implemented)

All tools return JSON data encoded as text content in MCP tool responses.

### 1) `giterloper_search`

Purpose:

- Search knowledge for a pin at a specific SHA (optional override).

Input schema:

- `pin?: string` (optional; omit to use session default)
- `query: string` (required)
- `sha?: string` (must match `/^[0-9a-f]{40}$/i` when provided)
- `limit?: integer` (`1..100`, default `20`)

Success payload:

- `ok: true`
- `sessionId?: string` (when session-scoped)
- `pin: string`
- `effectiveSha: string`
- `results: Array<{ path, title, snippet, score }>`

Validation: Explicit pin name `"default"` is rejected with `invalid_argument`; omit pin to use session default.

Implementation notes:

- Uses memsearch adapter with `buildOnDemand: true`.
- Resolves pin first, then applies `sha` override if provided.

### 2) `giterloper_retrieve`

Purpose:

- Retrieve file content at pin + SHA.

Input schema:

- `pin?: string` (optional; omit to use session default)
- `path: string` (required; relative path within knowledge store, e.g. `knowledge/foo.md`)
- `sha?: string` (40-char hex when provided)

Validation semantics:

- If `path` is missing or empty:
  - returns `invalid_argument` envelope
- Explicit pin name `"default"` is rejected with `invalid_argument`; omit pin to use session default.

Success payload:

- `ok: true`
- `sessionId?: string` (when session-scoped)
- `pin: string`
- `effectiveSha: string`
- `path: string`
- `content: string`

### 3) `giterloper_insert_pending`

Purpose:

- Queue markdown into `knowledge/_pending/` and push to remote branch.

Input schema:

- `pin?: string` (optional; omit to use session default)
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
- `sessionId?: string` (when session-scoped)
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

- `pin?: string` (optional; omit to use session default)

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
- `sessionId?: string` (when session-scoped)
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

- `sourcePin?: string` (optional; omit for session default)
- `targetPin?: string` (optional; omit for session default)

Reconcile side-defaulting: provide at least one of sourcePin or targetPin; the omitted side defaults to the session default pin.

Behavior details:

- Both pins must have branches.
- Source and target must point to same repo source.
- Source must be GitHub (`parseGithubSource` must succeed).
- Performs remote merge, then updates target pin SHA.

Success payload:

- `ok: true`
- `sessionId?: string` (when session-scoped)
- `action: "merged"`
- `source: { pin, branch, sha }`
- `target: { pin, branch, oldSha, newSha }`

### 6) `giterloper_pin_set`

Purpose:

- Set session default pin by reordering the session's pinned.yaml so the given pin is first. Requires a session. Omit `pin` to view current default without changing it.

Input schema:

- `pin?: string` (optional; pin name to set as default; omit to view current default)

Success payload:

- `ok: true`
- `sessionId?: string` (when session-scoped)
- `action: "pin_set"`
- `defaultPin: string`
- `message?: string` (when no change: "Only one pin; already default" or "Already session default")

Behavior: If there is only one pin or the named pin is already first, returns success with a `message` and no reorder. Otherwise mutates session pinned.yaml to put the pin first.

### 7) `giterloper_state_inspect`

Purpose:

- List pins and optionally run clone/freshness checks.

Input schema:

- `pin?: string` (if omitted, all pins)
- `verify?: boolean` (default `false`)

Success payload (list mode, `verify=false`):

- `ok: true`
- `sessionId?: string` (when session-scoped)
- `pins: Array<{ name, source, sha, branch | null }>`

Success payload (verify mode, `verify=true`):

- `ok: true`
- `sessionId?: string` (when session-scoped)
- `checks: Array<{ pin, branch, sha, clonePresent, cloneShaOk, workingCloneExists, branchFresh }>`  
  - `branchFresh` is `boolean | null`.
- When `pin` is omitted and there are no pins in the system: returns `{ ok: true, pins: [] }` (and optional `sessionId`) with no `checks` array.
- When `pin` is provided but names a non-existent pin: returns an error envelope `{ ok: false, code: "missing_pin", ... }` with `isError: true` (thrown by `resolvePin`).

### 8) `giterloper_session_end`

Purpose:

- Explicitly end the current MCP session and remove session-local state. Use when done with the session to free disk space.

Input schema:

- (no arguments)

Success payload:

- `ok: true`
- `sessionId: string`
- `action: "session_ended"`

Behavior: Removes `.giterloper/sessions/<sessionId>/` best-effort. Does not invalidate the protocol session; clients should stop using the session after calling this.

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
- Effective SHA is: the provided `sha` argument, or else the pin head SHA from the effective pinned config (shared `.giterloper/pinned.yaml` or session-scoped `.giterloper/sessions/<sessionId>/pinned.yaml`).
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
- `giterloper_pin_set`

Current auth behavior does not yet apply distinct read/write policy; this classification is available for policy extension.

## Concurrency and consistency behaviors

- Local-clone write tools (`giterloper_insert_pending`, `giterloper_reconcile_pending`) first call `ensureWorkingClone` (which uses `assertBranchReadyForWrite` to ensure the remote is reachable and pin SHA matches remote branch HEAD or the branch is not on remote yet), then `assertBranchFresh` before mutation. If the remote is unreachable in either step, the tool fails with code `external`. This is not applied to `giterloper_reconcile`, which performs a remote merge via the GitHub API.
- Pin SHA updates and clone lifecycle are coordinated through existing giterloper internals (`updatePinSha`, clone verification, working clone management).
- Memsearch calls include pin+sha context and can rebuild on demand; stale index mismatches map to explicit errors.

## What is not implemented (protocol/application level)

- No stdio MCP transport.
- No custom SSE endpoint in app code; MCP is handled through SDK streamable HTTP on `/mcp`.
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
