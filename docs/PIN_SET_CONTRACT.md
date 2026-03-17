# giterloper_pin_set: Canonical Contract and Compatibility Plan

**Status:** Approved  
**Related:** Epic git-6elj, tickets git-8vrv (implementation), git-hv9f (state_inspect alignment)

## 1. Canonical Contract

**Source of truth:** [docs/PIN_SETTING_PARAM_BEHAVIOR.md](./PIN_SETTING_PARAM_BEHAVIOR.md).

The canonical behavior for `giterloper_pin_set` is the **branch/ref configurator** model described there. Key decisions:

| Aspect | Canonical Behavior |
|--------|--------------------|
| **Session pin** | Named `_session`; omit `pin` to operate on it. Never pass `pin: "_session"`. |
| **Reserved name** | `_session` is reserved. Explicit `pin: "_session"` **always fails** with `invalid_argument`. |
| **branch/ref matrix** | Four cases (§1–§4): branch-only, ref-only, both, neither. Neither → FAIL. |
| **Pin storage** | Pins store `name`, `sha`, and optionally `branch`. Refs are resolved to SHA from remote. |
| **Eager branch push** | Assigning a branch to a pin immediately pushes (or fails with `branch_sha_mismatch`). |

Implementation MUST evolve to match the documented contract. Tests and docs are updated to reflect this behavior.

---

## 2. Backward-Compatibility Stance

### 2.1 Session pin vs first pin

- **Canonical:** Omit `pin` → operate on the pin named `_session`. If no pin named `_session` exists, **FAIL** with `missing_pin` and a message directing the user to configure the session pin (e.g. via `KNOWLEDGE_STORE_REMOTE` or `gl pin add` with name `_session`).
- **Legacy fallback (deprecated):** Some implementations may currently treat `pins[0]` as the session pin when no `_session` exists. This behavior is **deprecated**. New code paths MUST require an explicit `_session` pin. Deprecation period: until git-8vrv is implemented; after that, the fallback is removed.

### 2.2 Bootstrap

- **MCP sessions:** When `KNOWLEDGE_STORE_REMOTE` is set, new sessions auto-create the `_session` pin at remote `main` HEAD. No shared `pinned.yaml` is copied.
- **Empty state:** If no pins exist and `pin` is omitted, **FAIL** with `missing_pin`. To create the first pin, the caller must provide `source` and either `ref` or `branch`; with omitted `pin`, this creates the `_session` pin (implementation in git-8vrv).

### 2.3 Terminology

- Prefer **session pin** over "session default" or "default pin".
- Use **`_session`** when referring to the reserved name.

---

## 3. Behavior Matrix

### 3.1 Pin name (`pin`)

| `pin` value | Meaning |
|-------------|---------|
| **Omitted** | Operate on session pin (`_session`). Must exist unless creating it (source + ref/branch provided). |
| **Explicit name** | Add or update that named pin. Inherit source/SHA from session pin when not provided. |
| **`_session`** | **FAIL** — reserved. Use omitted `pin` instead. |

### 3.2 branch and ref

| `branch` | `ref` | Behavior |
|----------|-------|----------|
| specified | not specified | Use session pin SHA. Branch absent on remote → push and set. Branch exists → match SHA or FAIL (`branch_sha_mismatch`). |
| not specified | specified | Resolve ref to SHA. Verify on remote. Set pin at SHA, branchless (read-only). |
| specified | specified | Resolve ref to SHA. Verify on remote. Branch absent → push and set. Branch exists → match or FAIL. |
| not specified | not specified | **FAIL** with `invalid_argument`. Must specify at least one of `branch` or `ref`. |

### 3.3 _session handling

| Scenario | Outcome |
|----------|---------|
| `pin` omitted, session pin exists | Operate on session pin. |
| `pin` omitted, no pins | FAIL `missing_pin` unless creating (source + ref/branch). |
| `pin` omitted, pins exist but none named `_session` | FAIL `missing_pin` (no fallback after deprecation). |
| `pin: "_session"` | FAIL `invalid_argument` — reserved name. |

---

## 4. Error Codes and Deprecation Strategy

### 4.1 Error codes (pin_set-specific)

| Code | When |
|------|------|
| `invalid_argument` | Neither branch nor ref specified; explicit `pin: "_session"`; invalid/empty parameters. |
| `missing_pin` | No session pin and cannot create (e.g. no source); or no pins at all when operation requires session pin. |
| `branch_sha_mismatch` | Assigning branch to pin but remote branch exists with different SHA. Includes `pinName`, `pinSha`, `remoteSha`, `branch` in `details`. |
| (future) `sha_not_found` | Resolved SHA does not exist on remote. Currently may map to `external` or generic failure; recommend explicit code for clarity. |

### 4.2 Deprecation

- **First-pin-as-session fallback:** Remove when implementation aligns with canonical contract (git-8vrv). No new callers should rely on it.
- **Legacy terminology:** Update AGENTS.md, tool descriptions, and reference_client to use "session pin" and `_session` consistently (git-bp15, git-5lt8).

### 4.3 Unsupported arguments

- **Current:** Schema accepts `pin`, `source`, `ref`, `branch`. Unknown fields are typically ignored by Zod `.strict()` or equivalent.
- **Recommendation:** Reject unknown/unsupported fields with `invalid_argument` for stricter API hygiene. Implementation in git-8vrv.

---

## 5. Related Documents

- [docs/PIN_SETTING_PARAM_BEHAVIOR.md](./PIN_SETTING_PARAM_BEHAVIOR.md) — full decision tree and parameter semantics
- [AGENTS.md](../AGENTS.md) — MCP pin_set semantics (to be aligned in git-bp15)
- [lib/mcp-error-mapping.ts](../lib/mcp-error-mapping.ts) — error code mapping

---

## 6. Implementation Checklist (for git-8vrv)

- [ ] Require `_session` pin; remove `pins[0]` fallback
- [ ] Support creating first pin via `pin_set` with source + ref/branch (omit pin)
- [ ] Enforce argument validation (reject unknown fields)
- [ ] Add explicit `sha_not_found` error code when SHA missing on remote (optional)
- [ ] Align state_inspect output with session-pin semantics (git-hv9f)
