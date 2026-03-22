# CLI product contract

This document is the **normative** product-behavior spec for the **main `gl` CLI** and the separate **`gl-maintenance`** entrypoint. It pairs with `tests/cli/` (executable checks do not override this text). Day-to-day discovery SHOULD rely on **`gl` / `gl-maintenance --help`** and observed behavior; this file states cross-cutting contracts those surfaces must stay aligned with.

For **pin/ref/branch matrices, session-pin targeting, and `giterloper_pin_set`-equivalent rules**, see **[specs/core.md — Pin configuration semantics](./core.md#pin-configuration-semantics)**. This slice keeps **CLI help** and **CLI-tested** behaviors; it MUST NOT duplicate that matrix as a second authoritative copy.

---

## Invocation and output

- **`gl`** exposes: `diagnostic`, `pin …`, `insert`, `install-remote`, `reconcile`, `merge`.
- **`gl-maintenance`** (also shown in help as “gl maintenance”) exposes: `status`, `verify`, `clone`, `teardown`, `stage`, `stage-cleanup`, `promote`.

Global options: **`--session-id <id>`** (default **`_cli`**) and optional **`--mcp-test-mode`**. Session-scoped working state lives under **`.giterloper/<sessionId>/`** at the project root in normal mode, or **`.giterloper_test/<sessionId>/`** when **`--mcp-test-mode`** is set (integration / harness alignment with MCP test mode; see **`specs/MCP.md`**).

Commands that advertise **`--json`** emit structured results suitable for automation; human-oriented text mode remains available where help lists `--json`.

### memsearch (not required for CLI startup)

The **`gl`** and **`gl-maintenance`** entrypoints MUST **not** fail at process startup solely because the **memsearch** CLI is missing from **`PATH`**. Operators MAY use CLI-only workflows (for example maintenance or pin operations against a remote knowledge store) in environments without **memsearch**. Any future CLI command that performs search- or index-backed work MAY fail at **invocation** time when **memsearch** is unavailable; that failure is **command-scoped**, not a global boot gate. Contrast **`specs/MCP.md`**, where the MCP server MUST verify **memsearch** before accepting traffic.

---

## Pins (CLI)

### `pin list`

Lists configured pins (name, source, pinned SHA, and branch when present). With **`--json`**, output is machine-readable.

### `pin add <name> <source> [--ref <ref|sha>] [--branch <branch>]`

Adds a named pin and ensures a **version clone** exists at the resolved SHA under the session layout.

Semantics (from help, normative):

- **Branch only (`--branch X`):** resolve SHA from that branch on the remote; record branch + SHA; clone at SHA.
- **Ref/SHA only (`--ref`):** pin to resolved SHA **without** a stored branch (branchless pin); clone at SHA. Short SHAs (7+ hex) are expanded.
- **Branch + ref:** resolve SHA from `--ref` on the remote, store **branch** for writes, clone at that SHA.

**CLI-tested behaviors:**

- **`pin add` with `--ref` and `--branch` where the branch does not yet exist on the remote** creates the pin and clones from the resolved ref SHA; the stored branch name is the one supplied.
- **`pin add` with `--ref` and `--branch` where the branch already exists on the remote at a different commit than `--ref` resolves to** fails; the pin MUST NOT be recorded (“does not match” class failure).
- **Branchless pins** (ref-only add) support read-oriented flows but **MUST NOT** be used for operations that require a write branch (see Write operations).

### `pin remove <name>`

Removes the pin and tears down associated local pin data (including version clones for that pin) as reported by the command.

### `pin update <name> [--ref <ref>]`

Resolves a new SHA (from the given ref or default remote rules as implemented), clones it, and updates the pin. CLI tests expect **`updated`**, **`oldSha`**, **`newSha`**, and list state to reflect the new commit.

### `pin load [--pin <name>]`

Ensures pinned version(s) are shallow-cloned; omit **`--pin`** to load all. (Surfaced in help; not separately re-specified beyond alignment with help.)

---

## Freshness and fail-fast behavior

**`gl diagnostic`** (optional **`--pin`**) verifies pin/clone health and **branch freshness** relative to the remote branch head.

Before creating or mutating **staged** working copies, the CLI enforces that the **pinned SHA matches the current remote tip of the pin’s branch** when a branch is in play. If the remote has advanced (or otherwise diverges) so that the pin is stale:

- **`insert`** MUST fail before a staged working tree is created, with a **“does not match”** style error.
- **`gl-maintenance stage`** MUST fail before staging clones, with the same class of error.

When the pin matches the remote, **`insert`** after an explicit **`stage`** succeeds and writes under the staged tree as specified below.

---

## Staged working tree (`gl-maintenance`)

### `stage [branch] [--pin <name>]`

Materializes a **mutable working clone** for the given **pin** and **branch** under the session’s **`staged/<pinName>/<branch>/`** layout.

- First successful call for that pair reports **`created: true`** and returns the staged path.
- Subsequent calls for the same pair **reuse** the existing directory (**`created: false`**) and return the same path.

### `stage-cleanup [branch] [--pin <name>]`

Removes the staged directory for that pin/branch pair when present; reports **`cleaned`** and the path removed.

### `promote [--pin <name>]`

Pushes staged changes for the pin’s branch and **advances the pin’s SHA** to the new commit. Fails for **branchless** pins (“has no branch” class error).

---

## Readiness and inspection (`gl-maintenance`)

### `status`

Summarizes pins with clone presence and whether the clone is at the **expected pinned SHA**.

### `verify [--pin <name>]`

Extended verification with structured checks (clone present, SHA OK), suitable for deeper maintenance diagnostics than **`gl diagnostic`** alone.

---

## Knowledge writes (`gl`)

Write commands require a **branched pin** unless help explicitly documents otherwise.

### `insert [--pin <name>] [--name <name>]`

Reads **stdin** and queues markdown under **`knowledge/_pending/`** in the appropriate working context. **`--name`** sets the pending entry basename; the stored file uses a **`.md`** suffix. A successful insert **advances the pin SHA**.

For a **newly created branch** (pin added from base ref with a branch name not yet on the remote), the first successful **`insert`** creates the remote branch on push as part of the flow (CLI-tested).

### `reconcile [--pin <name>]`

Processes **`knowledge/_pending/`** into topic files under **`knowledge/`**, then deletes pending files only after their content is represented in topics. Reconciled topic bodies include a **Sources** section. Successful reconcile **advances the pin SHA** and reports touched and deleted paths in structured output.

### `install-remote <pin>`

Copies **`CONSTITUTION.md`** from the **current working directory** (the user’s project root where the command is run) to **`GITERLOPER.md`** at the **root of the pin’s staged repo**. **Branched pins only.** Success **advances the pin SHA**.

### `merge <source-pin> <target-pin>`

Merges the **source** pin’s branch into the **target** pin’s branch via the **GitHub API** (no local fetch in the merge step). Source and target MUST refer to the **same `github.com` repository** as stated in help. Success reports **`merged`** and advances the **target** pin’s SHA (**`oldSha`** / **`newSha`** in structured output).

---

## Non-goals (clarifying product boundaries)

- This spec does **not** define MCP transport behavior, HTTP auth, or MCP tool names; those belong to the MCP slice.
- It does **not** define test harness layout, environment injection, or contributor workflow; executable checks for this slice live under **`tests/cli/`** without this document mirroring individual test modules or harness code.
- Operational deployment, Docker, and host setup are out of scope here.
