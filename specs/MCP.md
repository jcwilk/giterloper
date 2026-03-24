# MCP product contract

This document is the **normative** product-behavior spec for the Model Context Protocol slice. It pairs with `tests/mcp/` (executable checks do not override this text). Day-to-day agent discovery SHOULD rely on **live MCP tool schemas, titles, and descriptions** and on observed server behavior; this file states cross-cutting contracts those surfaces must stay aligned with.

For **motivation, architecture context, and typical agent workflows** (non-normative product vision), see **[`docs/use-cases.md`](../docs/use-cases.md)**.

For **pin and `giterloper_pin_set` semantics** (session vs named pins, branch/ref matrix, merge-tool exceptions), see **[`specs/pin-semantics.md`](./pin-semantics.md)** (normative; no second copy here).

---

## Transports and parity

The server exposes the **same tool set and semantics** over:

- **Streamable HTTP** — JSON-RPC over `GET|POST /mcp` (with SSE where applicable for the transport), plus **`DELETE /mcp`** for transport-level session teardown (see Sessions).
- **stdio** — one MCP session per OS process; no HTTP session header.

Both paths MUST build behavior from the **shared** server factory (`createServer` in `lib/gl-mcp-server.ts`). Transport-specific code belongs only in the HTTP app or stdio entrypoint. Changing a tool, schema, or session rule in one transport without the other is a **parity bug**.

Operational runbooks (ports, env vars, deployment) live under `docs/` and MUST NOT contradict this contract.

---

## Knowledge store configuration (MCP)

### Modes: normal vs MCP test mode

- **`mcpTestMode` (boolean):** Default **`false`**. When **`true`**, the server is in **MCP test mode**: it MUST use the **test** session root directory and the **test** knowledge remote env var (below). When **`false`**, it MUST use the **normal** session root and the **production/dev** remote env var.

- **Activating MCP test mode:** The implementation MUST determine **`mcpTestMode`** the same way on **stdio** and **HTTP** entrypoints (parity). **Primary signal:** process command line — when the **`--mcp-test-mode`** flag is present on the MCP entrypoint (**`lib/gl-mcp-server.ts`** or **`lib/gl-mcp-server-stdio.ts`**), MCP test mode is **`true`**; when the flag is absent, **`false`**. There is **no** environment variable that toggles this mode. **In-process / tests:** `createServer` (or equivalent **`CreateServerOptions`**) MAY pass an explicit boolean **`mcpTestMode`** so factories and the unified harness can force test mode without argv.

### Environment variables for repository identity

| Mode | Env var supplying the knowledge Git remote | Required at MCP server startup |
|------|--------------------------------------------|--------------------------------|
| Normal (`mcpTestMode` **false**) | **`KNOWLEDGE_STORE_REMOTE`** | MUST be non-empty and valid |
| MCP test (`mcpTestMode` **true**) | **`TEST_KNOWLEDGE_STORE_REMOTE`** | MUST be non-empty and valid |

- **Startup failure:** If the env var for the active mode is unset, empty, or unusable at **process startup**, the implementation MUST **fail immediately** (non-zero exit, clear error on stderr) and MUST NOT listen for connections, accept MCP sessions, or run tool handlers without a defined store. Silent omission or lazy failure on first tool call is **not** compliant.

### memsearch CLI (mandatory at MCP startup)

Search and on-demand indexing are implemented by invoking the **memsearch** CLI (see **`specs/core.md`** — Search index adapter). For MCP, **memsearch** is a **core runtime dependency**, not an optional add-on.

- **Startup verification:** On **both** HTTP/SSE and **stdio** entrypoints, the implementation MUST verify that **memsearch** is **available to invoke** (for example resolvable on **`PATH`**) at the same phase as knowledge-remote validation—**before** binding listen ports (HTTP) or advertising readiness, and **before** accepting MCP sessions or running tool handlers. Failure MUST be **immediate**: non-zero process exit and a **clear error on stderr**. Lazy failure only when a client first calls **`giterloper_search`** is **not** compliant.

- **Parity:** Stdio and HTTP paths MUST use the **same** check (shared factory or shared helper called from both entrypoints) so one transport cannot start without **memsearch** while the other does.

Harness obligations for **`tests/mcp/`**, **`CreateServerOptions`** test overrides, and **`skipMemsearchVerification`** are documented in [tests/README.md](../tests/README.md) (operational detail for authors; not a second normative contract).

- **Repository identity vs clients:** The MCP server alone defines which Git remote is the knowledge store for a mode. MCP tool inputs MUST **not** include a **`source`** (or equivalent) parameter for choosing or overriding that remote. Session and named pins use the server-configured repository; see **[`specs/pin-semantics.md`](./pin-semantics.md)** for how **`giterloper_pin_set`** parameters map without client-supplied **`source`**.

### Session root directory names (normative, not env-configurable)

Under the configured project root (see **`specs/core.md`** and **`GITERLOPER_PROJECT_ROOT`**), session directories MUST live under exactly one of these **literal** single-segment names (no trailing slash in the contract name):

- **Normal mode:** **`.giterloper`**
- **MCP test mode:** **`.giterloper_test`**

The implementation MUST treat these as fixed constants (not derived from user env) so dev/prod and automated tests never accidentally point at the same on-disk tree when modes differ. Full path shape: **`<projectRoot>/<literal>/<sessionId>/`**.

---

## Sessions and state layout

- **HTTP:** After `initialize`, the server issues an `mcp-session-id` response header. Subsequent tool requests MUST carry that header (and the negotiated protocol version header) or fail with actionable guidance.
- **stdio:** The session id is **process-scoped**; the transport wires a fixed session identity into the shared core.

Per-session working state (including `pinned.yaml` and clones) lives under **`<projectRoot>/.giterloper/<sessionId>/`** in normal mode or **`<projectRoot>/.giterloper_test/<sessionId>/`** in MCP test mode. Session directories MUST use only safe path segments (no `..`, separators, or empty ids). Shared library code that resolves session paths (**`makeState`**, MCP session store, scavenging, cleanup) MUST use the same mode → directory mapping.

**`giterloper_session_end`** removes session-local data for that id. On HTTP, **`DELETE /mcp`** with the same session and protocol headers the client uses for tool calls MUST run equivalent session cleanup (transport-level teardown before the session id is discarded). The server MAY scavenge stale session directories using a configurable TTL. Clients MUST tolerate losing server-side sessions after process restart or deploy (re-`initialize`).

**Session pin bootstrap (MCP):** When a new MCP session becomes active (HTTP: after successful **`initialize`** for that session; stdio: when the transport attaches a session identity to the shared core), the implementation MUST **create or restore** the **`_session`** pin for that session so it references the **effective configured knowledge remote** for that server (normal: **`KNOWLEDGE_STORE_REMOTE`** / its override; MCP test: **`TEST_KNOWLEDGE_STORE_REMOTE`** / its override) at that remote’s **default branch HEAD** (resolved to a stored SHA) **before** any tool handler runs for that session. Under normal operation, an active MCP session MUST **not** have an empty pin list or a missing **`_session`** entry. If on-disk state is corrupted so **`_session`** is absent while the session is otherwise active, tool calls that require pin resolution MUST fail with **`missing_pin`** (or an explicit, documented failure) rather than accepting client-supplied repository overrides.

---

## Observability (effective mode and remote)

Operators and tests MUST be able to read which mode and remote the running MCP server instance uses **without** relying on client-supplied **`source`**.

- **`GET /health` (HTTP/SSE app):** The JSON body MUST include **`mcpTestMode`** (boolean) and **`configuredKnowledgeStoreRemote`** (string, the effective remote used for session bootstrap and pin identity for that process).

- **`giterloper_state_inspect`:** On **successful** tool results (including empty pin list), the JSON body MUST include the same **`mcpTestMode`** and **`configuredKnowledgeStoreRemote`** fields alongside existing fields (e.g. **`sessionId`**, **`pins`**, **`checks`**), so **stdio** clients observe parity with **`/health`** for these diagnostics.

Both transports MUST report **identical semantics** for these fields for a given server instance.

---

## Pins and tools (contract level)

The internal session pin name is always **`_session`**. Callers target it by **omitting** pin-related arguments where the tool allows. The literal string `_session` MUST NOT be passed as a user pin name; it is reserved and rejected.

| Tool | Contract role |
|------|----------------|
| `giterloper_search` | Search the knowledge store at a pinned SHA (on-demand index). |
| `giterloper_retrieve` | Read file content by path at a pinned SHA. |
| `giterloper_insert_pending` | Queue markdown under `knowledge/_pending/`. |
| `giterloper_reconcile_pending` | Fold pending content into topic files under `knowledge/`. |
| `giterloper_merge` | Merge one pin’s branch into another via the GitHub API. |
| `giterloper_pin_set` | View or configure the session pin and named pins per **specs/pin-semantics.md** (branch/ref matrix, reserved `_session`). Repository identity is server-only; inputs are **pin**, **ref**, **branch** only—no **source**. |
| `giterloper_state_inspect` | List pins; optional clone/freshness checks. |
| `giterloper_session_end` | Tear down session-local server state. |

**Legacy:** the former name `giterloper_reconcile` refers to the same behavior as **`giterloper_merge`**; callers MUST use `giterloper_merge`.

**Write tools** (mutate knowledge, pins, or merge) require a pin with a **branch** where the product enforces branchful writes. **Read tools** do not perform those mutations.

---

## Authentication (HTTP)

- Unless **insecure mode** is enabled for local development only, requests MUST authenticate with **`Authorization: Bearer <token>`** matching **`MCP_TOKEN`**.
- **Read** vs **write** tools are classified for policy hooks; the baseline expectation is that unauthenticated or invalid-token requests are denied consistently with that policy.
- Insecure mode MUST NOT be used in production deployments.

---

## Error envelope and codes

Structured tool failures return JSON in the tool result body:

```json
{ "ok": false, "code": "<code>", "message": "<string>", "details": {} }
```

Normative codes include: `unauthorized`, `invalid_argument`, `missing_pin`, `branchless_write`, `branch_sha_mismatch`, `stale_index`, `mismatched_sha`, `reconciliation_conflict`, and `external`. The unauthorized case uses a deterministic envelope (`code` `unauthorized`, message `Authentication required`, empty `details`).

For HTTP, **`unauthorized`** maps to **401**. Other codes have a defined HTTP status mapping for layers that surface HTTP status; tool-level errors are primarily carried in the MCP result body.

---

## Search index isolation

Search and index usage MUST be **isolated per pin and commit SHA**. No cross-version index reuse: mismatched or stale index metadata MUST fail closed rather than serving the wrong snapshot. Implementation details belong in code and tests, but the isolation boundary is part of the product contract.
