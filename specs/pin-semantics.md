# Pin configuration semantics

This document is the **normative** product-behavior spec for **pin naming**, **`giterloper_pin_set`** (and equivalent pin configuration at any **user-facing** API boundary), the **branch/ref matrix**, session vs named pins, merge-tool exceptions, and related error codes. **Primary executable coverage** for this pin-law material lives under **`tests/pin-semantics/`**, paired with this file. **`tests/core/`** continues to exercise **shared library** behavior under [`specs/core.md`](./core.md) (paths, `pinned.yaml` storage, queues, session layout, and related core contracts)—those tests do **not** imply that all pin-adjacent or pin-law scenarios moved out of **`tests/core/`**; substantive pin-law cases belong in **`tests/pin-semantics/`** as that tree grows. **`specs/cli.md`** and **`specs/MCP.md`** defer here for this material; they **MUST NOT** restate the matrix as a second authoritative copy.

This document defines the **exact** behavior of **`giterloper_pin_set`**. The decision tree below MUST be implemented precisely. **`specs/cli.md`** describes CLI command shapes; **`specs/MCP.md`** describes MCP transport and tool inventory—both defer here for pin naming, session pin rules, and the **branch/ref** matrix.

## Surfaces (CLI vs MCP)

| Surface | How pin configuration is expressed |
|---------|-------------------------------------|
| **MCP `giterloper_pin_set`** | Optional **`pin`**, **`ref`**, **`branch`** per tool schema only. Omit **`pin`** → session pin. **`source` MUST NOT** appear on MCP tool inputs; repository identity comes solely from server configuration (normal: **`KNOWLEDGE_STORE_REMOTE`**; MCP test: **`TEST_KNOWLEDGE_STORE_REMOTE`** — see **`specs/MCP.md`**). |
| **MCP `giterloper_merge`** | Two pin arguments (source and target). **Merge tool exception** below. |
| **Other MCP tools** (e.g. `giterloper_insert_pending`) | Optional pin name where the schema allows; same **Pin name** rules as `pin_set`. |
| **CLI `gl pin add` / updates** | **`--ref`** and **`--branch`** combine into the same four **branch/ref** cases: branch-only, ref-only, both, neither (the latter is invalid for add). CLI help and **`specs/cli.md`** name the flags; outcomes MUST match the matrix in this document. |

## Pin storage

Pins store exactly: **name**, **sha**, and optionally **branch**. The session pin's name is always **`_session`**. The product never stores a non-SHA ref in a pin; if the caller passes a ref (e.g. a branch or tag name), the implementation resolves it to a SHA from the remote and stores that SHA.

## Pin name (`pin` / `pinName`)

| Input | Meaning |
|-------|---------|
| **Omitted** | Operate on the **session pin**. The session pin is the one agents use by default; it is identified by **omitting** the pin parameter, never by name. Its stored name is always **`_session`**. |
| **Explicit name** | Add a pin by that name (if it doesn't exist), or change an existing pin by that name. |
| **`_session`** | **Always fail.** The literal string **`_session`** is reserved. To refer to the session pin, **omit** the parameter. |

**All commands** follow this same pin-name paradigm: the reserved name is never allowed as a user-supplied pin identifier; omitting the pin parameter refers to the session pin. The only exception is the merge tool (see below).

## Merge tool exception

The merge tool takes **two** pin parameters (source and target). At most **one** may be omitted; whichever is omitted resolves to the session pin. **If both are omitted**, both resolve to the session pin — i.e. merging a pin into itself — which MUST **fail** with a message that you cannot merge a pin into itself. The same failure applies when both pin names are explicitly the same (e.g. both `"foo"`).

## branch and ref matrix

When configuring a pin (session or named), the **`branch`** and **`ref`** parameters interact as follows. **`ref`** may be a full SHA or a ref (branch, tag, etc.); if it is not a SHA, the implementation resolves it from the remote and uses the resulting SHA. Pins always store a SHA, never a ref.

### 1. Branch specified, ref not specified

**Implication:** The caller wants to copy the **session pin's SHA** to the target pin (or update the session pin's branch).

1. **Target SHA** = session pin's current SHA.
2. **Check if the branch exists on remote.**
   - **If it does NOT exist:** Take the target SHA; push the new branch to remote from a clone at that SHA; set the pin with that SHA and branch.
   - **If it DOES exist:** Check if the remote branch HEAD matches the target SHA.
     - **If it matches:** Set up the pin without pushing (branch already exists).
     - **If it does NOT match:** **FAIL** with an explanation that you cannot push a different SHA to an existing branch (include pin SHA and remote branch HEAD in the error).

### 2. ref specified, branch not specified

**Implication:** Set up the target pin at the commit identified by **ref**, **branchlessly**. The pin is read-only: without a branch, no new commits can be added via branchful write flows.

1. Resolve ref to a SHA from the remote (if ref is not already a full SHA).
2. Verify the SHA exists on the remote (see **SHA validation** below).
3. Set the pin with that SHA and no branch.

### 3. Both ref and branch specified

**Implication:** Set up the target pin at the commit identified by **ref** with the specified branch.

1. Resolve ref to a SHA from the remote (if ref is not already a full SHA).
2. Verify the SHA exists on the remote (see **SHA validation** below).
3. **Check if the branch exists on remote.**
   - **If it does NOT exist:** Take the resolved SHA; push the new branch to remote from a clone at that SHA; set the pin with that SHA and branch.
   - **If it DOES exist:** Check if the remote branch HEAD matches the resolved SHA.
     - **If it matches:** Set up the pin without pushing (branch already exists).
     - **If it does NOT match:** **FAIL** with an explanation that you cannot push a different SHA to an existing branch (include pin SHA and remote branch HEAD in the error).

### 4. Neither branch nor ref specified

**FAIL.** The caller has not specified anything meaningful to configure. This almost certainly indicates a misuse of the tool. Return an error directing them to specify at least one of **`branch`** or **`ref`**.

**View-only:** For **`giterloper_pin_set`**, when **`pin`** is omitted and **neither** **`branch`** nor **`ref`** is supplied, the tool **returns** the current session pin state (read) rather than treating that as case 4. Case 4 applies when adding or changing a **named** pin without **`branch`** or **`ref`**, and for any other mutating configuration where both are absent.

## SHA validation

**At any point** where a SHA is used (resolved from ref or taken from the session pin):

- The SHA **must** exist on the remote.
- If the SHA does **not** exist on the remote, **FAIL** with a clear explanation that the SHA could not be found on the remote.

This typically happens during clone/fetch. The error message should indicate that the commit may not exist on the remote.

## Summary table (branch/ref)

| branch | ref | Behavior |
|--------|-----|----------|
| specified | not specified | Use session pin SHA. Branch exists? Match → set pin. No match → fail. Branch absent? Push branch, set pin. |
| not specified | specified | Resolve ref to SHA. Verify on remote. Set pin at SHA, branchless (read-only). |
| specified | specified | Resolve ref to SHA. Verify on remote. Branch exists? Match → set pin. No match → fail. Branch absent? Push branch, set pin. |
| not specified | not specified | **FAIL** for named-pin mutation — must specify at least one of branch or ref. (Omitting pin with no modifiers on **`pin_set`** is the view-session-pin case.) |

## Session pin existence and bootstrap

| Scenario | Outcome |
|----------|---------|
| **`pin` omitted, session pin exists** | Operate on session pin. |
| **`pin` omitted, no pins** | **MCP:** MUST NOT occur for an active session after bootstrap (**`specs/MCP.md`**). If **`pinned.yaml`** is empty or lacks **`_session`** while the MCP session is active, treat as corrupt state or lifecycle bug; FAIL **`missing_pin`** (or explicit failure) with guidance—clients MUST NOT supply **`source`** to recover. **CLI / other surfaces** that allow caller-supplied repository identity MAY still create the session pin when the user provides that identity and at least one of **`ref`** or **`branch`** per CLI rules. |
| **`pin` omitted, pins exist but none named `_session`** | FAIL **`missing_pin`** (no legacy “first pin is session” fallback for API surfaces). |
| **`pin: "_session"`** | FAIL **`invalid_argument`** — reserved name; omit **`pin`** instead. |

**MCP bootstrap:** New MCP sessions MUST create or restore **`_session`** at the **effective configured knowledge remote** for that server (per mode: **`KNOWLEDGE_STORE_REMOTE`** vs **`TEST_KNOWLEDGE_STORE_REMOTE`**) at default branch HEAD before tool handling; see **`specs/MCP.md`**. **`giterloper_pin_set`** does not create the session pin’s repository binding from client **`source`**—that binding is server-defined.

**Terminology:** Prefer **session pin** over “default pin”. Use **`_session`** when referring to the reserved stored name.

## Error codes (pin_set-related)

Structured failures use the MCP/tool error envelope; normative **`code`** values for this area include:

| Code | When |
|------|------|
| **`invalid_argument`** | Neither branch nor ref specified where mutation requires them; explicit **`pin: "_session"`**; invalid/empty parameters; unknown fields if the implementation rejects them. |
| **`missing_pin`** | No session pin when one is required; **MCP:** includes corrupt or empty session state where **`_session`** is missing after bootstrap. Not used on MCP to request client **`source`**—repository identity is server-side only. |
| **`branch_sha_mismatch`** | Assigning a branch to a pin but the remote branch exists at a different SHA than required. Details SHOULD include pin name, pin SHA, remote SHA, and branch where applicable. |
| **`external`** (or dedicated future code) | Resolved SHA does not exist on remote, if not mapped to a more specific code. |

**API hygiene:** Only documented fields belong on **`pin_set`** inputs; implementations SHOULD reject unknown fields with **`invalid_argument`** where validation is strict.

## Related implementation

Runtime mapping from failures to codes lives in **`lib/mcp-error-mapping.ts`** (code-level detail; this document defines intended semantics).

---

## Non-goals

- This document does **not** define MCP **transport**, HTTP routing, or **stdio** session headers; those belong to the MCP slice.
- It does **not** enumerate **CLI** subcommands beyond what the matrix requires; full command shapes are in **`specs/cli.md`**.
- It does **not** define **deployment**, Docker, or host environment setup.
