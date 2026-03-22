# MCP product contract

This document is the **normative** product-behavior spec for the Model Context Protocol slice. It pairs with `tests/mcp/` (executable checks do not override this text). Day-to-day agent discovery SHOULD rely on **live MCP tool schemas, titles, and descriptions** and on observed server behavior; this file states cross-cutting contracts those surfaces must stay aligned with.

For **pin and `giterloper_pin_set` semantics** (session vs named pins, branch/ref matrix, merge-tool exceptions), the detailed decision tree remains in [`docs/PIN_SETTING_PARAM_BEHAVIOR.md`](../docs/PIN_SETTING_PARAM_BEHAVIOR.md) until consolidated under a single area spec in tracked work.

---

## Transports and parity

The server exposes the **same tool set and semantics** over:

- **Streamable HTTP** — JSON-RPC over `GET|POST /mcp` (with SSE where applicable for the transport), plus **`DELETE /mcp`** for transport-level session teardown (see Sessions).
- **stdio** — one MCP session per OS process; no HTTP session header.

Both paths MUST build behavior from the **shared** server factory (`createServer` in `lib/gl-mcp-server.ts`). Transport-specific code belongs only in the HTTP app or stdio entrypoint. Changing a tool, schema, or session rule in one transport without the other is a **parity bug**.

Operational runbooks (ports, env vars, deployment) live under `docs/` and MUST NOT contradict this contract.

---

## Sessions and state layout

- **HTTP:** After `initialize`, the server issues an `mcp-session-id` response header. Subsequent tool requests MUST carry that header (and the negotiated protocol version header) or fail with actionable guidance.
- **stdio:** The session id is **process-scoped**; the transport wires a fixed session identity into the shared core.

Per-session working state (including `pinned.yaml` and clones) lives under **`.giterloper/<sessionId>/`** at the configured project root. Session directories MUST use only safe path segments (no `..`, separators, or empty ids).

**`giterloper_session_end`** removes session-local data for that id. On HTTP, **`DELETE /mcp`** with the same session and protocol headers the client uses for tool calls MUST run equivalent session cleanup (transport-level teardown before the session id is discarded). The server MAY scavenge stale session directories using a configurable TTL. Clients MUST tolerate losing server-side sessions after process restart or deploy (re-`initialize`).

When **`KNOWLEDGE_STORE_REMOTE`** is set, new HTTP sessions MAY auto-bootstrap the session pin (`_session`) from that remote’s default branch HEAD so tools are usable without a prior `pin_set`.

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
| `giterloper_pin_set` | View or configure the session pin and named pins. |
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
