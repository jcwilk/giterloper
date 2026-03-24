# Core library product contract

This document is the **normative** product-behavior spec for **shared library logic** exercised by **`tests/core/`** (executable checks do not override this text). It describes paths, pin file handling, reconciliation helpers, read/search adapters, external retry policy, and other cross-cutting contracts that **CLI and MCP** must stay aligned with. **Pin configuration at the user-facing boundary** (session vs named pins, branch/ref matrix, **`giterloper_pin_set`**) is specified in **[`specs/pin-semantics.md`](./pin-semantics.md)**; this file covers **`pinned.yaml`** formats, **`resolvePin`**, and session pin naming rules that pair with that document. Day-to-day discovery SHOULD follow **`gl` / MCP tool help** and the **CLI** and **MCP** area specs for command- and transport-specific rules.

Executable coverage for this slice lives under **`tests/core/`**; helper modules under **`tests/helpers/`** are harness-only and are not mirrored here.

---

## Session layout and path algebra

- **Product / repository root (`projectRoot`):** **`GITERLOPER_PROJECT_ROOT`**, when set to a trimmed non-empty value, MUST be treated as the product root for **`makeState`’s** **`state.projectRoot`**, constitution paths (for example **`docs/CONSTITUTION.md`** resolution relative to the product root), append-only retry logs under **`logs/giterloper-retry.log`**, and other callers that intentionally share this root. When unset or empty, the implementation MUST use the process current working directory (resolved absolutely) as that root. This root MUST **not** be confused with the optional **MCP test session parent** below: setting **`GITERLOPER_PROJECT_ROOT`** alone MUST **not** change where **`.giterloper_test`** session trees live when a separate session-parent override applies.
- **Session root:** Working state for a session id lives under **`<sessionsParent>/<sessionBase>/<sessionId>/`**, where **`<sessionBase>`** is **`.giterloper`** in normal mode and **`.giterloper_test`** when **MCP test mode** is **`true`** (see **`specs/MCP.md`**: **`--mcp-test-mode`** on MCP / **`gl` / `gl-maintenance`**, and in-process overrides). **`<sessionBase>`** MUST remain these **literal** single-segment names (basename not configurable via environment). **Shared core** used by **both** MCP and **CLI** MUST apply the same **`sessionsParent`** and **`<sessionBase>`** mapping.
- **`sessionsParent` (normal mode):** **`sessionsParent`** MUST equal **`projectRoot`** (as above).
- **`sessionsParent` (MCP test mode):** Let **`projectRoot`** be as above. Optional environment variable **`GITERLOPER_MCP_TEST_SESSION_PARENT`** (exact name) MAY supply a **non-empty** path; see **precedence** and **validation** below. When the variable is **unset**, empty, or whitespace-only, **`sessionsParent`** MUST be **`projectRoot`**. When it is **set** to a non-empty value after trim, **`sessionsParent`** MUST be the **validated, absolute** path produced by resolution rules below. Full test-mode session tree shape: **`<sessionsParent>/.giterloper_test/<sessionId>/`** (literal **`.giterloper_test`** segment).
- **Precedence (MCP test session parent):** When **MCP test mode** is **`false`**, **`GITERLOPER_MCP_TEST_SESSION_PARENT`** MUST be **ignored** (no effect on layout). When **MCP test mode** is **`true`** and the variable is unset/empty, **`sessionsParent`** MUST be **`projectRoot`**. When **MCP test mode** is **`true`** and the variable is set (non-empty after trim), **`sessionsParent`** MUST be the resolved override path.
- **Resolving `GITERLOPER_MCP_TEST_SESSION_PARENT`:** If the value is **relative**, it MUST be resolved to an absolute path using the **same anchor** as **`projectRoot`**: trimmed non-empty **`GITERLOPER_PROJECT_ROOT`** → resolve relative to the absolute product root derived from that value; otherwise resolve relative to the absolute process current working directory (same rules as **`makeState`** / **`lib/gl-core.ts`**). The implementation MUST reject unsafe or ambiguous values (including **`..`** as a path segment and other patterns that would break single-directory safety), as enforced in **`lib/session-layout.ts`**; invalid values MUST fail with a clear error rather than silently relocating session data.
- **Harness note:** The unified test harness SHOULD pass **only absolute** paths in **`GITERLOPER_MCP_TEST_SESSION_PARENT`** to worker children so resolution does not depend on each child’s **`cwd`** (see **`tests/README.md`**).
- **Derived paths:** Under the session root, **version clones** are rooted at **`versions/`**, **staged** working trees at **`staged/`**, **`pinned.yaml`** at the session root, and **search indexes** at **`indexes/<pinName>/<sha>/`** (full 40-character SHA in the path segment).
- **Session id validation:** A session id MUST be non-empty and MUST NOT contain characters that would break a single safe path segment (including **`..`**, path separators, or other disallowed characters as enforced by validation).

---

## `pinned.yaml`: formats, session pin, and mutation

- **Formats:** The file supports **nested** entries (`repo`, `sha`, optional `branch`) and a **legacy one-line** form **`name: host/path@sha`**. Invalid entries MUST be rejected with a clear parse error. **`serializePins` / `parsePinned`** round-trip for supported shapes; an empty pin list serializes to an empty document.
- **Missing file:** When **`pinned.yaml`** is absent, reads behave as **no configured pins** (empty list), not as a hard failure.
- **Session pin name:** The internal session pin is stored as **`_session`**. User-supplied pin names MUST NOT be the literal **`_session`**; that name is **reserved** (callers target the session pin by **omitting** the pin argument at CLI/MCP boundaries—see **`specs/pin-semantics.md`**). Passing **`_session`** as an explicit user pin name MUST be rejected.
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

The adapter invokes the **memsearch** CLI for index build and search. **MCP** servers MUST treat **memsearch** as mandatory at startup (**`specs/MCP.md`** — memsearch CLI). The **`gl`** / **`gl-maintenance`** CLIs do **not** require **memsearch** at process startup (**`specs/cli.md`**).

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

## Non-goals (clarifying product boundaries)

- This spec does **not** define the full **pin configuration decision tree** or **branch/ref matrix** at user-facing boundaries; that normative contract is **[`specs/pin-semantics.md`](./pin-semantics.md)**.
- It does **not** define MCP **transport**, HTTP routing, or **stdio** session headers; those belong to the MCP slice.
- It does **not** enumerate **CLI** subcommands or **`gl-maintenance`** surface area beyond what is implied by shared paths and pins; those belong to the CLI slice.
- It does **not** define **deployment**, Docker, or host environment setup.
