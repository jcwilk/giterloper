---
id: git-ewer
status: open
deps: [git-c2km]
links: []
created: 2026-03-24T02:22:19Z
type: task
priority: 2
assignee: user.email
parent: git-shfx
---
# Extract pin-semantics tests; fix spec citations in tests and lib

**After `git-c2km`:** Directory, `deno task test:pin-semantics`, and harness docs exist. This ticket **populates** `tests/pin-semantics/` with pin-law coverage and **cleans citations** in tests and lib.

**MCP surface vs pin law:** Tests that assert **MCP-only** concerns (e.g. **`tools/list`** schema shape for `giterloper_pin_set`, **`source` absent**, transport/session wiring) should **stay in `tests/mcp/`** unless clearly duplicated; **`tests/pin-semantics/`** should own **branch/ref matrix, session vs named pin, merge exception, reserved `_session`** behavior per **`specs/pin-semantics.md`**, even if invoked via MCP helpers. Document per-file split choices in the close note.

Move or surgically split tests whose **primary** job is normative pin configuration: **`giterloper_pin_set`** branch/ref matrix, merge-tool exception, reserved `_session`, named-pin validation—per **`specs/pin-semantics.md`**. Primary sources: **`tests/mcp/mcp-pin-set.test.ts`**, **`tests/mcp/mcp-merge.test.ts`** (pin-name / merge-exception), **`tests/mcp/mcp-insert-pending.test.ts`** (see below), **`tests/core/pin-lifecycle.test.ts`**. **Incidental** pin usage stays in MCP/CLI integration tests; **transport / session bootstrap / HTTP parity** stay in **`tests/mcp/`**. Shared helpers remain under **`tests/helpers/`**; fix imports.

**`mcp-insert-pending.test.ts`:** Either **move** the `_session` pin-law case(s) into `tests/pin-semantics/` (preferred if clean) or **leave** in MCP with updated spec comments only—**document the choice** in the close note.

**Citations:** Replace stale **`specs/core.md (Pin configuration semantics)`**, **`specs/core.md §…`** matrix comments, and **`#pin-configuration-semantics`** on core where they referred to migrated content—use **`specs/pin-semantics.md`** and **current** headings.

**Implementation / product strings:** Update **`lib/gl-mcp-server.ts`** tool description and comments and **`lib/pinned.ts`** comments. If the **`giterloper_pin_set` tool description** string changes, keep **`specs/MCP.md`** (and any paired user-visible MCP contract text) **in sync** per AGENTS pairing rules—same change set or explicit follow-up.

## Acceptance Criteria

- `deno task test` and `deno task test:pin-semantics` green.
- No **`PIN_CONFIG_SPEC`** (or equivalent) pointing at **`specs/core.md`** for pin matrix / pin_set semantics.
- **Grep closure (tests + `lib/`):** no remaining **`specs/core.md (Pin configuration semantics)`**; no **`specs/core.md §`** comments that describe the migrated branch/ref matrix (replace with pin-semantics headings). Title overlap **# Pin configuration semantics** on **pin-semantics.md** is fine—use judgment so grep is not noisy false positives.
- Close note: **extraction/split** summary; **`mcp-insert-pending`** decision; any **MCP.md** sync performed or ticketed.
