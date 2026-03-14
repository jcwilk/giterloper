# Memsearch Adapter — Boundary and Runtime Assumptions

This document describes the memsearch adapter integration in giterloper: the runtime boundary, isolation model, and deterministic behavior. Referenced by git-dadj and dependent implementation tickets.

---

## 1. Scope

The memsearch adapter provides search/index capabilities for giterloper's version-pinned knowledge stores. It wraps the [memsearch](https://github.com/zilliztech/memsearch) CLI and enforces strict isolation per pin+sha so that:

- Index namespace is unique per (pinName, sha)
- Querying pin+sha A can never read index for pin+sha B
- Stale or mismatched metadata causes explicit failure (fail closed), never fallback to another version's index

---

## 2. Runtime Boundary

**Integration model:** Deno invokes memsearch via **subprocess** (Node `spawnSync`). memsearch is an external Python CLI; giterloper does not embed or bundle it.

**Requirements:**

- **memsearch** must be installed and on `PATH`. Install with: `pip install memsearch`
- **Embedding provider:** memsearch uses OpenAI by default. Set `OPENAI_API_KEY` or configure another provider via memsearch's config (see memsearch docs). The adapter passes `--milvus-uri` only; embedding config is inherited from memsearch's environment/config.
- **Milvus Lite:** Each index uses Milvus Lite (file-based). No separate Milvus server required.

**Invoked commands:**

- `memsearch index <sourcePath> --milvus-uri <path> [--force]` — build index
- `memsearch search <query> --milvus-uri <path> --json-output --top-k <n>` — search

The adapter runs these from the project root. Deterministic: same (pinName, sha) + same source content → same index path and metadata.

---

## 3. Index Layout and Isolation

**Directory structure:**

```
.giterloper/indexes/<pinName>/<sha>/
  metadata.json   # pin, sha, source path, build fingerprint
  milvus.db       # Milvus Lite vector store (managed by memsearch)
```

**Namespace uniqueness:** Each (pinName, sha) has its own directory. No sharing. Different pins or different SHAs of the same pin use different directories.

**Source path:** Indexes are built from the pin's clone: `.giterloper/versions/<pinName>/<sha>/`. memsearch recursively scans for `.md` and `.markdown` files.

---

## 4. Metadata and Fail-Closed Behavior

**metadata.json** records:

| Field | Description |
|-------|-------------|
| `pinName` | Pin name |
| `sha` | 40-character commit SHA |
| `sourcePath` | Path that was indexed |
| `buildFingerprint` | Adapter/version identifier for rebuild decisions |

**Before every search**, the adapter reads metadata (if present) and validates:

- `metadata.pinName === requestedPinName`
- `metadata.sha === requestedSha`

If metadata exists but does not match → throw `StaleIndexError`. No fallback to another index.

If metadata is missing but milvus.db exists → treat as corrupt, fail (rebuild required).

---

## 5. Build-on-Demand

When `search(..., { buildOnDemand: true, pin })` is called and no index exists:

1. Verify `pin` matches requested (pinName, sha)
2. Ensure clone exists at that SHA
3. Build index via `memsearch index`
4. Write metadata
5. Run search

**Deterministic:** Build always uses the clone at the requested SHA. No reuse of another version's index.

---

## 6. Error Mapping

| Adapter error | MCP code |
|---------------|----------|
| `StaleIndexError` (metadata mismatch) | `stale_index` (409) |
| Clone missing / wrong SHA | `external` or fail before search |
| memsearch not installed or fails | `external` (500) |

---

## 7. Testing

Unit tests mock `run`/`runSoft` to avoid requiring memsearch. Tests verify:

- Index path uniqueness per pin+sha
- Metadata validation and `StaleIndexError` on mismatch
- No cross-version index reuse
- Build-on-demand path when enabled

Integration/E2E tests (when memsearch is available) can run real index and search flows.
