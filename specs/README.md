# Product specs (slice hub)

Thin index of **behavior slices**: canonical markdown under `specs/`, primary test folder, and the **pairing** obligation (spec ↔ tests ↔ user-visible strings where applicable).

For repo-wide precedence (`specs/` vs tests vs code), **`docs/`** demotion, and agent workflow, see **[AGENTS.md](../AGENTS.md)** (including **Where to read contracts**). For harness layout, runner behavior, and how **`tests/<topic>/`** trees relate to slices (without duplicating this hub as a second index), see **[tests/README.md](../tests/README.md)**.

| Slice | Spec | Primary tests | Pairing / notes |
|--------|------|---------------|-----------------|
| **core** | [core.md](./core.md) | `tests/core/` | Shared library behavior; `tests/helpers/` and runner mechanics are **not** duplicated in area specs—see **tests/README.md**. |
| **pin-semantics** | [pin-semantics.md](./pin-semantics.md) | `tests/pin-semantics/` | `giterloper_pin_set`, session pin, branch/ref matrix, and related errors—**executable pin-law** lives here. |
| **cli** | [cli.md](./cli.md) | `tests/cli/` | **CLI help** and other user-visible CLI contract text stay **in sync** with this spec. |
| **mcp** | [mcp.md](./mcp.md) | `tests/mcp/` | **MCP tool descriptions** and transport parity stay **in sync** with this spec. **Pin/session/ref law** is normative in **pin-semantics**; **mcp.md** defers there—do not treat MCP tests as a second authority for that matrix. |
| **reconciliation** | [reconciliation.md](./reconciliation.md) | `tests/reconciliation/` + cross-slice coverage in `tests/cli/`, `tests/mcp/` | Shared **inbox → corpus** reconcile (**`gl reconcile`**, **`giterloper_reconcile_pending`**): agentic LLM integration, batching (one pending per pass), full-scope success, git/GitHub ordering—**CLI** / **MCP** defer here; pair help and tool strings. |

**Cross-slice:** Where **core** and **pin-semantics** both constrain behavior, they must agree; prefer **pin-semantics** + **`tests/pin-semantics/`** for pin-law scenarios. **Reconcile** behavior is normative in **reconciliation**; **cli** / **mcp** / **core** must not contradict it.
