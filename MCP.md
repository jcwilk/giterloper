# Giterloper MCP

Giterloper exposes the same tools over **Streamable HTTP** (`GET|POST /mcp`) and **stdio** (one session per process). Both transports use the shared server factory `createServer` in `lib/gl-mcp-server.ts`; keep tool behavior and schemas in that module so the transports stay in sync.

## Session and pins

- State lives under `.giterloper/<sessionId>/` (see `AGENTS.md`).
- **Session pin:** internal name is always `_session`. Callers target it by **omitting** the `pin` / `sourcePin` / `targetPin` argument where the tool allows—**never** pass the literal string `_session` as a pin name; it is reserved and rejected. Full rules for `giterloper_pin_set` (branch/ref matrix, merge exception) are in [`docs/PIN_SETTING_PARAM_BEHAVIOR.md`](docs/PIN_SETTING_PARAM_BEHAVIOR.md) and the overview in [`docs/PIN_SET_CONTRACT.md`](docs/PIN_SET_CONTRACT.md).

## Tools

| Tool | Role |
|------|------|
| `giterloper_search` | Search at a pinned SHA (memsearch; on-demand index) |
| `giterloper_retrieve` | Read file content by path at a pinned SHA |
| `giterloper_insert_pending` | Queue markdown under `knowledge/_pending/` |
| `giterloper_reconcile_pending` | Fold pending into topic files under `knowledge/` |
| `giterloper_merge` | Merge one pin’s branch into another via GitHub API |
| `giterloper_pin_set` | View or configure the session pin and named pins |
| `giterloper_state_inspect` | List pins; optional clone/freshness checks |
| `giterloper_session_end` | Tear down session-local data |

Legacy name: `giterloper_reconcile` was renamed to **`giterloper_merge`**; update any old callers.

## Error shape

Structured failures use JSON in the tool result body:

```json
{ "ok": false, "code": "<code>", "message": "<string>", "details": {} }
```

Codes include `unauthorized`, `invalid_argument`, `missing_pin`, `branchless_write`, `branch_sha_mismatch`, `stale_index`, `mismatched_sha`, `reconciliation_conflict`, and `external`. HTTP transport also returns **401** with an `unauthorized` body when `Authorization: Bearer` does not match `MCP_TOKEN` (unless `MCP_INSECURE` is set for local dev). Details are implemented in `lib/mcp-error-mapping.ts` and `lib/mcp-auth.ts`.

## Index isolation

Search/index usage is isolated per pin and SHA; no cross-version index reuse. Implementation notes: `lib/memsearch-adapter.ts`.
