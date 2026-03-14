# MCP API Contract — Giterloper

Contract-first specification for giterloper's MCP interface over HTTP/SSE. Defines tool names, request/response schemas, error envelopes, state-id semantics, and migration expectations. Referenced by git-mor9 (HTTP/SSE server), git-dadj (memsearch adapter), and dependent implementation tickets.

---

## 1. Scope and boundaries

**Giterloper does not perform web research.** Giterloper strictly manages knowledge that is externally submitted. All intelligence about what to research and how to find information lives in external agents. Giterloper is a knowledge backend: it stores, indexes, searches, and retrieves knowledge pushed to it by agents. This boundary is non-negotiable and MUST be documented in all MCP server descriptions and user-facing documentation.

---

## 2. Transport

- **HTTP/SSE only.** No stdio transport is implemented for MCP. The server operates as an independent process handling multiple client connections.
- **Endpoints:**
  - Regular HTTP POST endpoint for client messages
  - SSE endpoint for clients to receive server messages
- **Session flow:** Client connects to SSE endpoint, receives `endpoint` event with URI for subsequent POST requests; server responses delivered as SSE `message` events with JSON-encoded content.
- **Security:** Servers MUST implement authentication; SHOULD bind to localhost when running locally; MUST validate `Origin` header to prevent DNS rebinding.

---

## 3. State semantics

### 3.1 State identification

Every operation is scoped to a **pin** and an **effective SHA**.

| Input | Semantics |
|-------|-----------|
| **pin** (required) | Named store from `.giterloper/pinned.yaml`. Maps to `{ name, source, sha, branch? }`. |
| **sha** (optional) | Explicit 40-character hex commit SHA. If omitted, resolved from pin's current `sha` in pinned.yaml (pin head). |

**Resolution order:** `sha` argument overrides pin's stored SHA. Write operations MUST use pin head (no explicit sha override for write target).

### 3.2 Version-pinned reads

- **search** and **retrieve** accept optional `sha`. When provided, the operation runs against that exact commit. When omitted, the pin's current stored SHA is used.
- The response MUST include `effectiveSha` — the SHA actually used for the operation.

### 3.3 Write operations and SHA reporting

Write operations (insert_pending, reconcile) update the pin's stored SHA. Every write response MUST include:

| Field | Description |
|-------|-------------|
| `oldSha` | Pin SHA before the write |
| `newSha` | Pin SHA after the write (commit HEAD) |

---

## 4. Tools

### 4.1 `giterloper_search`

Search knowledge at a pinned version.

**Arguments:**

```json
{
  "type": "object",
  "properties": {
    "pin": { "type": "string", "description": "Pin name (required)" },
    "query": { "type": "string", "description": "Search query (required)" },
    "sha": { "type": "string", "description": "Optional 40-char commit SHA; defaults to pin head" },
    "limit": { "type": "integer", "description": "Max results (default 20)", "default": 20 }
  },
  "required": ["pin", "query"]
}
```

**Success response shape (state attribution required):**

```json
{
  "ok": true,
  "pin": "string",
  "effectiveSha": "string",
  "results": [
    {
      "path": "string",
      "title": "string",
      "snippet": "string",
      "score": 0.0
    }
  ]
}
```

### 4.2 `giterloper_retrieve`

Retrieve content by path or identifier at a pinned version.

**Arguments:**

```json
{
  "type": "object",
  "properties": {
    "pin": { "type": "string", "description": "Pin name (required)" },
    "path": { "type": "string", "description": "Relative path within knowledge store (e.g. knowledge/foo.md)" },
    "id": { "type": "string", "description": "Alternative: opaque identifier if indexing supports it" },
    "sha": { "type": "string", "description": "Optional 40-char commit SHA; defaults to pin head" }
  },
  "required": ["pin"]
}
```

**Note:** At least one of `path` or `id` must be provided. Implementation MUST validate and return a validation error if both are omitted.

**Success response shape:**

```json
{
  "ok": true,
  "pin": "string",
  "effectiveSha": "string",
  "path": "string",
  "content": "string"
}
```

### 4.3 `giterloper_insert_pending`

Queue new knowledge into `knowledge/_pending/`. Equivalent to CLI `gl insert`.

**Arguments:**

```json
{
  "type": "object",
  "properties": {
    "pin": { "type": "string", "description": "Pin name (required)" },
    "content": { "type": "string", "description": "Markdown content to queue (required)" },
    "name": { "type": "string", "description": "Optional filename hint; server may generate if omitted" }
  },
  "required": ["pin", "content"]
}
```

**Success response shape (oldSha/newSha required):**

```json
{
  "ok": true,
  "action": "inserted",
  "pin": "string",
  "branch": "string",
  "file": "string",
  "oldSha": "string",
  "newSha": "string"
}
```

### 4.4 `giterloper_reconcile`

Merge source pin's branch into target pin's branch via GitHub API. Equivalent to CLI `gl merge`.

**Arguments:**

```json
{
  "type": "object",
  "properties": {
    "sourcePin": { "type": "string", "description": "Source pin name (required)" },
    "targetPin": { "type": "string", "description": "Target pin name (required)" }
  },
  "required": ["sourcePin", "targetPin"]
}
```

**Success response shape (oldSha/newSha required):**

```json
{
  "ok": true,
  "action": "merged",
  "source": { "pin": "string", "branch": "string", "sha": "string" },
  "target": {
    "pin": "string",
    "branch": "string",
    "oldSha": "string",
    "newSha": "string"
  }
}
```

### 4.5 `giterloper_state_inspect`

Inspect pin state: list pins, verify clone health, branch freshness.

**Arguments:**

```json
{
  "type": "object",
  "properties": {
    "pin": { "type": "string", "description": "Optional pin name; omit to list all pins" },
    "verify": { "type": "boolean", "description": "If true, include clone/health checks", "default": false }
  }
}
```

**Success response shape (list mode):**

```json
{
  "ok": true,
  "pins": [
    {
      "name": "string",
      "source": "string",
      "sha": "string",
      "branch": "string | null"
    }
  ]
}
```

**Success response shape (verify mode):**

```json
{
  "ok": true,
  "checks": [
    {
      "pin": "string",
      "branch": "string | null",
      "sha": "string",
      "clonePresent": true,
      "cloneShaOk": true,
      "workingCloneExists": true,
      "branchFresh": true
    }
  ]
}
```

---

## 5. Error envelope

All error responses MUST use a consistent envelope:

```json
{
  "ok": false,
  "code": "string",
  "message": "string",
  "details": {}
}
```

| Field | Description |
|-------|-------------|
| `ok` | Always `false` for errors |
| `code` | Machine-readable error code (see below) |
| `message` | Human-readable description |
| `details` | Optional extra context (e.g. `expectedSha`, `remoteSha`) |

### 5.1 Error codes

| Code | Description | HTTP/Status |
|------|-------------|-------------|
| `unauthorized` | Missing or invalid authentication (Bearer token) | 401 |
| `missing_pin` | Pin name not found in pinned.yaml | 404 |
| `stale_index` | Index metadata does not match requested pin+sha; rebuild or sync required | 409 |
| `mismatched_sha` | Pin SHA does not match remote branch HEAD; sync with `pin update` | 409 |
| `branchless_write` | Write operation attempted on pin without `branch` | 400 |
| `invalid_argument` | Invalid or missing required arguments (e.g. both path and id omitted for retrieve) | 400 |
| `reconciliation_conflict` | Merge cannot be completed automatically (GitHub merge conflict) | 409 |
| `external` | Git, GitHub, or I/O failure | 500 |

### 5.2 Error code mapping from CLI

| CLI/GlError | MCP code |
|-------------|----------|
| `pin "${name}" not found` | `missing_pin` |
| `no pins configured` | `missing_pin` |
| Index metadata mismatch (git-dadj) | `stale_index` |
| `branch is stale`, `pin SHA does not match remote` | `mismatched_sha` |
| `pin has no branch` | `branchless_write` |
| GitHub merge conflict | `reconciliation_conflict` |
| Clone, push, API failures | `external` |

---

## 6. Backward-compatible schema evolution

- **Additive changes only.** New optional arguments and new optional response fields are allowed. Do not remove or rename existing fields.
- **New tools** may be added; existing tool names MUST remain stable.
- **Error codes** may be extended; existing codes MUST retain their semantics.

---

## 7. Concurrency expectations

- **pinned.yaml writes** are protected by a FIFO mutex; concurrent mutators serialize.
- **Search/retrieve** are read-only; safe to parallelize per pin+sha.
- **Write operations** (insert_pending, reconcile) MUST acquire appropriate locks; clients SHOULD retry on transient conflicts (`mismatched_sha`, `reconciliation_conflict`).
- **Stale detection:** If local working clone HEAD ≠ remote branch HEAD, the server returns `mismatched_sha` before attempting write. Client must sync (e.g. via `pin update` or equivalent) and retry.

---

## 8. Migration from CLI to MCP

| CLI command | MCP tool | Parity |
|-------------|----------|--------|
| `gl pin list` | `giterloper_state_inspect` (no pin arg) | Full |
| `gl diagnostic` / `gl verify` | `giterloper_state_inspect` with `verify: true` | Full |
| `gl insert` | `giterloper_insert_pending` | Full |
| `gl merge` | `giterloper_reconcile` | Full |
| (no CLI equivalent) | `giterloper_search` | New |
| (no CLI equivalent) | `giterloper_retrieve` | New |

**Out of MCP scope (CLI-only):**

- `gl pin add`, `gl pin remove`, `gl pin update`, `gl pin load` — pin lifecycle managed via config/deployment, not MCP
- `gl install-remote` — deployment/setup concern
- `gl-maintenance` commands — internal maintenance; not exposed to agents

**Scope and parity:** The MCP surface provides read (search, retrieve, state inspect) and write (insert_pending, reconcile) capabilities for agents. Pin lifecycle remains a deployment concern. Clients that previously used `gl insert` and `gl merge` via CLI can migrate to MCP tools with equivalent semantics and response shapes including `oldSha`/`newSha`.

---

## 9. References

- MCP transports: [modelcontextprotocol.io/specification/2024-11-05/basic/transports](https://modelcontextprotocol.io/specification/2024-11-05/basic/transports)
- USE_CASES.md — Giterloper use cases and architecture
- BASELINE_AUDIT_AND_MIGRATION.md — Current CLI state and migration checklist
- CONSTITUTION.md — Contract between Giterloper and knowledge stores (`knowledge/_pending` layout)
