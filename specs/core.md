# Core library product contract

This document is the **normative** product-behavior spec for **shared library logic** exercised by **`tests/core/`** (executable checks do not override this text). It describes paths, pin file handling, reconciliation helpers, read/search adapters, external retry policy, and **pin configuration at the product boundary** that **CLI and MCP both rely on**. Day-to-day discovery SHOULD follow **`gl` / MCP tool help** and the **CLI** and **MCP** area specs for command- and transport-specific rules; this file states cross-cutting contracts those surfaces must stay aligned with.

**[Pin configuration semantics](#pin-configuration-semantics)** (below) is the **single normative** home for the **`giterloper_pin_set`** decision tree, session vs named pins, and the **branch/ref matrix**, including how **CLI** flags and **MCP** parameters map to outcomes. **MCP** never takes client **`source`**; repository identity is server-defined (**`specs/MCP.md`**). **CLI** MAY accept caller-supplied repository identity per **`specs/cli.md`**. **`specs/cli.md`** and **`specs/MCP.md`** link here; they MUST NOT restate that matrix as a second authoritative copy.

Executable coverage for this slice lives under **`tests/core/`**; helper modules under **`tests/helpers/`** are harness-only and are not mirrored here.

---

## Session layout and path algebra

- **Session root:** Working state for a session id lives under **`<projectRoot>/<sessionBase>/<sessionId>/`**, where **`<sessionBase>`** is **`.giterloper`** by default. When **MCP test mode** is **`true`** (see **`specs/MCP.md`**: **`GITERLOPER_MCP_TEST_MODE`** and in-process overrides), **`<sessionBase>`** MUST be **`.giterloper_test`**, using these **literal** directory names (not configurable via environment). **Shared core** used by **both** MCP and **CLI** MUST apply the same mapping so integration tests that spawn **`gl`** and MCP with test mode enabled keep all session state under **`.giterloper_test`** and off **`.giterloper`**.
- **Derived paths:** Under that session root, **version clones** are rooted at **`versions/`**, **staged** working trees at **`staged/`**, **`pinned.yaml`** at the session root, and **search indexes** at **`indexes/<pinName>/<sha>/`** (full 40-character SHA in the path segment).
- **Project root:** **`GITERLOPER_PROJECT_ROOT`** (non-empty) redirects **`<projectRoot>`** for **`makeState`**, MCP session store paths, and related helpers; otherwise **`cwd`** resolves the project root. Session **base** (`.giterloper` vs `.giterloper_test`) still follows MCP test mode per **`specs/MCP.md`**.
- **Session id validation:** A session id MUST be non-empty and MUST NOT contain characters that would break a single safe path segment (including **`..`**, path separators, or other disallowed characters as enforced by validation).

---

## `pinned.yaml`: formats, session pin, and mutation

- **Formats:** The file supports **nested** entries (`repo`, `sha`, optional `branch`) and a **legacy one-line** form **`name: host/path@sha`**. Invalid entries MUST be rejected with a clear parse error. **`serializePins` / `parsePinned`** round-trip for supported shapes; an empty pin list serializes to an empty document.
- **Missing file:** When **`pinned.yaml`** is absent, reads behave as **no configured pins** (empty list), not as a hard failure.
- **Session pin name:** The internal session pin is stored as **`_session`**. User-supplied pin names MUST NOT be the literal **`_session`**; that name is **reserved** (callers target the session pin by **omitting** the pin argument at CLI/MCP boundaries—see **[Pin configuration semantics](#pin-configuration-semantics)**). Passing **`_session`** as an explicit user pin name MUST be rejected.
- **`resolvePin`:** When no pin name is supplied, resolution selects the **`_session`** entry if present. If **`_session`** is missing, the product surfaces an error that guides recovery. For **MCP**, a missing **`_session`** on an active session indicates an invariant violation or corrupt state (the MCP contract requires **`_session`** to exist after session bootstrap—see **`specs/MCP.md`**). For **CLI**, recovery guidance MAY include commands that add or configure pins using caller-supplied repository identity. The **`_session`** entry MUST be findable regardless of its position in the YAML document order.
- **Concurrency:** Pin file updates for a session go through **`mutatePins`** for that session’s **`pinned.yaml`** without cross-session locking (each session directory is independent).

**Internal vs user-facing:** **`updatePinSha`** and similar **internal** lifecycle helpers MAY receive the session pin’s internal name when higher layers omitted an explicit pin; that path MUST NOT be confused with **user-facing** validation that forbids registering **`_session`** as a normal named pin.

---

## Pending queue filenames

- **`safeName`:** User-visible names are trimmed; disallowed characters become hyphens; leading/trailing hyphens are stripped. Empty or whitespace-only input yields a deterministic default basename. Allowed characters include alphanumeric, dot, underscore, and hyphen.
- **`makeQueueFilename`:** When a name argument is provided, it drives the filename and **`.md`** is appended if missing. When no name is provided, the implementation derives a short, stable hashed filename ending in **`.md`**.

---

## Reconciliation helpers (`knowledge/_pending/` → topics)

- **Topic key:** The topic slug is taken from the **first Markdown `#` heading** when present; otherwise it falls back to the **pending file stem**. Slugs are sanitized for use as filenames.
- **Grouping and merge:** Pending entries are grouped by topic. Merged topic bodies include prior content and new material, with **`## Sources`** listing contributing pending filenames. Boilerplate newlines are normalized (excessive blank lines collapsed) in both existing and incoming bodies.
- **Ordering:** When multiple pending entries contribute to one topic, ordering by **`addEpoch`** is ascending, with **`0`** treated as **last**.

---

## Reading files from version clones

**`retrieveFileContent`** reads a path inside the **version clone** for a pin at the **requested SHA**. It MUST:

- Fail clearly when **no clone** exists for that pin/SHA.
- Reject paths that **escape** the clone root (path traversal), even if the underlying OS would allow them.
- Fail when the path is **inside** the clone but the file **does not exist**.

---

## Search index adapter (on-demand index)

- **Metadata location:** Per-index metadata lives beside the index store as **`metadata.json`** under **`indexes/<pinName>/<sha>/`**.
- **Metadata handling:** Missing metadata file yields **null** / absent metadata for readers; **invalid JSON** is treated as absent metadata for read purposes. **Write then read** of metadata round-trips the recorded fields (**pin name**, **SHA**, **source path**, **build fingerprint**).
- **Fail closed on mismatch:** Search MUST **not** use an index whose stored metadata **pin name or SHA** does not match the **requested** pin and SHA. The same pin with a **different SHA** in metadata MUST **not** be reused (no cross-version index reuse). When on-disk index files exist but metadata is missing or unusable, search MUST fail with guidance that **rebuild** is required rather than silently reading the wrong snapshot.
- **`buildOnDemand`:** When building on demand is requested, the supplied **pin object** MUST match the **requested pin name and SHA** exactly; otherwise the operation MUST fail before indexing.

For **transport-level** search tools and duplicate high-level isolation wording, see the **MCP** area spec; the rules here are the **library-level** contract **`tests/core/`** enforces.

---

## External retries (git and GitHub)

- **GitHub REST:** Responses MAY be classified for **bounded retry** (for example **503** honoring **`Retry-After`**, or **rate-limited 403** with reset headers). **401**, **422**, and **merge POST 409** MUST **not** be retried as transient success paths.
- **Git stderr:** Common **network flake** messages are treated as transient; **authentication** class failures are not.
- **Argument classification:** Helpers exist to detect **git** argument lists that imply **network-touching** operations (for example **`ls-remote`**) versus purely local commands.
- **Backoff:** Retry backoff MUST be **positive** and **bounded** per policy parameters.

---

## Pin configuration semantics

This section defines the **exact** behavior of **`giterloper_pin_set`** (and equivalent pin configuration at any **user-facing** API boundary). The decision tree below MUST be implemented precisely. **`specs/cli.md`** describes CLI command shapes; **`specs/MCP.md`** describes MCP transport and tool inventory—both defer here for pin naming, session pin rules, and the **branch/ref** matrix.

### Surfaces (CLI vs MCP)

| Surface | How pin configuration is expressed |
|---------|-------------------------------------|
| **MCP `giterloper_pin_set`** | Optional **`pin`**, **`ref`**, **`branch`** per tool schema only. Omit **`pin`** → session pin. **`source` MUST NOT** appear on MCP tool inputs; repository identity comes solely from server configuration (normal: **`KNOWLEDGE_STORE_REMOTE`**; MCP test: **`TEST_KNOWLEDGE_STORE_REMOTE`** — see **`specs/MCP.md`**). |
| **MCP `giterloper_merge`** | Two pin arguments (source and target). **Merge tool exception** below. |
| **Other MCP tools** (e.g. `giterloper_insert_pending`) | Optional pin name where the schema allows; same **Pin name** rules as `pin_set`. |
| **CLI `gl pin add` / updates** | **`--ref`** and **`--branch`** combine into the same four **branch/ref** cases: branch-only, ref-only, both, neither (the latter is invalid for add). CLI help and **`specs/cli.md`** name the flags; outcomes MUST match the matrix in this section. |

### Pin storage

Pins store exactly: **name**, **sha**, and optionally **branch**. The session pin's name is always **`_session`**. The product never stores a non-SHA ref in a pin; if the caller passes a ref (e.g. a branch or tag name), the implementation resolves it to a SHA from the remote and stores that SHA.

### Pin name (`pin` / `pinName`)

| Input | Meaning |
|-------|---------|
| **Omitted** | Operate on the **session pin**. The session pin is the one agents use by default; it is identified by **omitting** the pin parameter, never by name. Its stored name is always **`_session`**. |
| **Explicit name** | Add a pin by that name (if it doesn't exist), or change an existing pin by that name. |
| **`_session`** | **Always fail.** The literal string **`_session`** is reserved. To refer to the session pin, **omit** the parameter. |

**All commands** follow this same pin-name paradigm: the reserved name is never allowed as a user-supplied pin identifier; omitting the pin parameter refers to the session pin. The only exception is the merge tool (see below).

### Merge tool exception

The merge tool takes **two** pin parameters (source and target). At most **one** may be omitted; whichever is omitted resolves to the session pin. **If both are omitted**, both resolve to the session pin — i.e. merging a pin into itself — which MUST **fail** with a message that you cannot merge a pin into itself. The same failure applies when both pin names are explicitly the same (e.g. both `"foo"`).

### branch and ref matrix

When configuring a pin (session or named), the **`branch`** and **`ref`** parameters interact as follows. **`ref`** may be a full SHA or a ref (branch, tag, etc.); if it is not a SHA, the implementation resolves it from the remote and uses the resulting SHA. Pins always store a SHA, never a ref.

#### 1. Branch specified, ref not specified

**Implication:** The caller wants to copy the **session pin's SHA** to the target pin (or update the session pin's branch).

1. **Target SHA** = session pin's current SHA.
2. **Check if the branch exists on remote.**
   - **If it does NOT exist:** Take the target SHA; push the new branch to remote from a clone at that SHA; set the pin with that SHA and branch.
   - **If it DOES exist:** Check if the remote branch HEAD matches the target SHA.
     - **If it matches:** Set up the pin without pushing (branch already exists).
     - **If it does NOT match:** **FAIL** with an explanation that you cannot push a different SHA to an existing branch (include pin SHA and remote branch HEAD in the error).

#### 2. ref specified, branch not specified

**Implication:** Set up the target pin at the commit identified by **ref**, **branchlessly**. The pin is read-only: without a branch, no new commits can be added via branchful write flows.

1. Resolve ref to a SHA from the remote (if ref is not already a full SHA).
2. Verify the SHA exists on the remote (see **SHA validation** below).
3. Set the pin with that SHA and no branch.

#### 3. Both ref and branch specified

**Implication:** Set up the target pin at the commit identified by **ref** with the specified branch.

1. Resolve ref to a SHA from the remote (if ref is not already a full SHA).
2. Verify the SHA exists on the remote (see **SHA validation** below).
3. **Check if the branch exists on remote.**
   - **If it does NOT exist:** Take the resolved SHA; push the new branch to remote from a clone at that SHA; set the pin with that SHA and branch.
   - **If it DOES exist:** Check if the remote branch HEAD matches the resolved SHA.
     - **If it matches:** Set up the pin without pushing (branch already exists).
     - **If it does NOT match:** **FAIL** with an explanation that you cannot push a different SHA to an existing branch (include pin SHA and remote branch HEAD in the error).

#### 4. Neither branch nor ref specified

**FAIL.** The caller has not specified anything meaningful to configure. This almost certainly indicates a misuse of the tool. Return an error directing them to specify at least one of **`branch`** or **`ref`**.

**View-only:** For **`giterloper_pin_set`**, when **`pin`** is omitted and **neither** **`branch`** nor **`ref`** is supplied, the tool **returns** the current session pin state (read) rather than treating that as case 4. Case 4 applies when adding or changing a **named** pin without **`branch`** or **`ref`**, and for any other mutating configuration where both are absent.

### SHA validation

**At any point** where a SHA is used (resolved from ref or taken from the session pin):

- The SHA **must** exist on the remote.
- If the SHA does **not** exist on the remote, **FAIL** with a clear explanation that the SHA could not be found on the remote.

This typically happens during clone/fetch. The error message should indicate that the commit may not exist on the remote.

### Summary table (branch/ref)

| branch | ref | Behavior |
|--------|-----|----------|
| specified | not specified | Use session pin SHA. Branch exists? Match → set pin. No match → fail. Branch absent? Push branch, set pin. |
| not specified | specified | Resolve ref to SHA. Verify on remote. Set pin at SHA, branchless (read-only). |
| specified | specified | Resolve ref to SHA. Verify on remote. Branch exists? Match → set pin. No match → fail. Branch absent? Push branch, set pin. |
| not specified | not specified | **FAIL** for named-pin mutation — must specify at least one of branch or ref. (Omitting pin with no modifiers on **`pin_set`** is the view-session-pin case.) |

### Session pin existence and bootstrap

| Scenario | Outcome |
|----------|---------|
| **`pin` omitted, session pin exists** | Operate on session pin. |
| **`pin` omitted, no pins** | **MCP:** MUST NOT occur for an active session after bootstrap (**`specs/MCP.md`**). If **`pinned.yaml`** is empty or lacks **`_session`** while the MCP session is active, treat as corrupt state or lifecycle bug; FAIL **`missing_pin`** (or explicit failure) with guidance—clients MUST NOT supply **`source`** to recover. **CLI / other surfaces** that allow caller-supplied repository identity MAY still create the session pin when the user provides that identity and at least one of **`ref`** or **`branch`** per CLI rules. |
| **`pin` omitted, pins exist but none named `_session`** | FAIL **`missing_pin`** (no legacy “first pin is session” fallback for API surfaces). |
| **`pin: "_session"`** | FAIL **`invalid_argument`** — reserved name; omit **`pin`** instead. |

**MCP bootstrap:** New MCP sessions MUST create or restore **`_session`** at the **effective configured knowledge remote** for that server (per mode: **`KNOWLEDGE_STORE_REMOTE`** vs **`TEST_KNOWLEDGE_STORE_REMOTE`**) at default branch HEAD before tool handling; see **`specs/MCP.md`**. **`giterloper_pin_set`** does not create the session pin’s repository binding from client **`source`**—that binding is server-defined.

**Terminology:** Prefer **session pin** over “default pin”. Use **`_session`** when referring to the reserved stored name.

### Error codes (pin_set-related)

Structured failures use the MCP/tool error envelope; normative **`code`** values for this area include:

| Code | When |
|------|------|
| **`invalid_argument`** | Neither branch nor ref specified where mutation requires them; explicit **`pin: "_session"`**; invalid/empty parameters; unknown fields if the implementation rejects them. |
| **`missing_pin`** | No session pin when one is required; **MCP:** includes corrupt or empty session state where **`_session`** is missing after bootstrap. Not used on MCP to request client **`source`**—repository identity is server-side only. |
| **`branch_sha_mismatch`** | Assigning a branch to a pin but the remote branch exists at a different SHA than required. Details SHOULD include pin name, pin SHA, remote SHA, and branch where applicable. |
| **`external`** (or dedicated future code) | Resolved SHA does not exist on remote, if not mapped to a more specific code. |

**API hygiene:** Only documented fields belong on **`pin_set`** inputs; implementations SHOULD reject unknown fields with **`invalid_argument`** where validation is strict.

### Related implementation

Runtime mapping from failures to codes lives in **`lib/mcp-error-mapping.ts`** (code-level detail; this section defines intended semantics).

---

## Non-goals (clarifying product boundaries)

- This spec does **not** define MCP **transport**, HTTP routing, or **stdio** session headers; those belong to the MCP slice.
- It does **not** enumerate **CLI** subcommands or **`gl-maintenance`** surface area beyond what is implied by shared paths and pins; those belong to the CLI slice.
- It does **not** define **deployment**, Docker, or host environment setup.
