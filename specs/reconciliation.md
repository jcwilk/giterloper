# Reconciliation (inbox → corpus)

This document is the **normative** product contract for **reconcile** semantics shared by the **CLI** command **`gl reconcile`** and the **MCP** tool **`giterloper_reconcile_pending`**.

---

## Inbox and corpus

- **Inbox:** **`knowledge/_pending/`** holds **pending** markdown items (files or entries), typically queued by **`giterloper_insert_pending`** (MCP) or **`gl insert`** (CLI).
- **Corpus:** Durable knowledge lives under **`knowledge/**/*.md`** **outside** the inbox (arbitrary subdirectory structure under **`knowledge/`** as the implementation creates or updates it).
- **Pending queue filenames** (how basenames are formed) are specified in **`specs/core.md`** — **Pending queue filenames**.

---

## Integration (decomposition and placement)

**Normative requirement — large language models:** Integration **MUST** use a **large language model** (LLM)—invoked via an **LLM API** or an **in-process** step that performs **LLM inference**—as an **essential** part of producing the integrated corpus for each reconcile run.

**LLM-led product path:** Reconciliation into the knowledge store **MUST** be **LLM-led** on the integration path this document defines. **LLM inference** **MUST** be applied to **integrate** pending content into the corpus for that run—placement, deduplication, merging, and revision of corpus text per this section—not solely for classification, routing, metadata, or surface formatting while substantive integration is performed **without** LLM inference.

The integrated corpus **MUST NOT** be produced using only **deterministic** or **purely mechanical** pipelines (rule-based append/split, fixed heuristics, string or template transforms without LLM inference), even when they rearrange or copy text. **Human-only** editing, **scripted** transforms, or other assistance **without** **LLM inference** as required here **MUST NOT** satisfy this section. **Any** **automatic script-based integration**—rule pipelines, or heuristics that place or name corpus content **without** **LLM inference** as required here—is **not** an acceptable substitute for the normative integration **MUST**s. **No** purported **“equivalent”** substitute—including **agent-assisted** workflows that **skip** **LLM inference** for integration—relaxes these **MUST**s.

**Why LLMs are required:** The product assumes **open-ended, continuous** insertion of knowledge into a growing corpus. Mechanical append/split strategies **cannot** reliably prevent **near-duplicate** or **overlapping** facts from accumulating, or keep **contradictions** from persisting unreconciled, at the level this contract demands. That product goal **requires** the **semantic** integration capability that **LLM inference** provides; the **normative** rules above are **not** satisfied by automation, tooling, or labeling that omits **LLM inference** as specified.

**Gardening on write:** Pending input **MUST** be **conceptually merged** into the existing corpus—**woven** into the same fabric—not merely **pasted**, **chunked beside** existing text, or **indexed** next to it without integration. The intended analogy is a human **revising a reference article** after learning new information: the **whole** remains **coherent**; the writer may **restructure** headings, sections, or hierarchy to reflect **updated** understanding. Integration **MUST** pursue that quality bar: **deduplication** of overlapping substance where it would otherwise bloat or confuse readers; **revision or resolution** where facts **contrast** (subject to **Conflict resolution (incoming knowledge wins)** below); and **coherent restructuring** of files and **`knowledge/`** layout when needed—not only additive edits.

The operation **MUST** process each pending item and use LLM-backed decomposition to **break up** inbox content and **integrate** it **throughout** the existing markdown under **`knowledge/`**, including creating or updating **multiple** **`.md`** files and **`knowledge/`** **subdirectories** when a hierarchy improves navigation. Model vendor and exact API are **not** specified; **LLM inference** **is** specified.

### Anti-pattern: mechanical shortcuts

**Not a substitute for LLM integration:** **Filename/topic extraction heuristics**, fixed placement rules, and similar **mechanical** steps **MUST NOT** replace or satisfy the **LLM integration** **MUST**s in this section; **semantic integration via LLM inference** remains normative.

**Hidden invariants:** Mechanical shortcuts such as **deriving filenames or placement from the first markdown heading** (or similar fixed heuristics) are **wrong** for this slice because they encode **hidden invariants**—for example that content **must** have a heading, that the heading **must** be suitable as a filename segment, and that ordering and edge cases become **undeclared** product rules carried by the heuristic rather than by explicit contract text.

The implementation **MUST NOT** satisfy the contract by only merging each pending file into a **single** existing topic file keyed solely by first heading or filename stem (i.e. **not** a “single-file-append” shortcut for the whole run).

### Structure (SHOULD-level quality)

File names, subdirectory layout, headings, and chunk boundaries **SHOULD** be chosen so the corpus stays **coherent** for readers and **findable** via markdown indexing and search (sensible granularity, not one giant undifferentiated file when multiple topics are present).

### Conflict resolution (incoming knowledge wins)

When **new** knowledge from **`_pending/`** and **existing** corpus content **disagree** on substance, the integration **MUST** treat the **incoming** pending material as **authoritative** for that reconcile run. **Existing** passages in **`knowledge/**/*.md`** that conflict with the new knowledge **MUST** be **revised or removed** so the integrated corpus **aligns** with the pending content. The implementation **MUST NOT** preserve stale corpus claims over pending **solely** because they appeared first, and **MUST NOT** fail a run **only** because the corpus previously stated something incompatible with pending.

---

## Provenance

Corpus files that receive integrated pending content **MUST** include a **`## Sources`** section listing **contributing pending filenames** (the pending entry basenames as integrated in that run). **Normative `## Sources` obligations live in this document**; **`specs/core.md`** records path and **pending queue filename** rules only.

---

## Integration completeness and atomicity

**Substantive** content is content not treated as empty or negligible for integration purposes (for example not only whitespace with no integratable meaning); exact classification is **implementation-defined** but **MUST** respect the rules below.

**All-or-nothing:** A reconcile run **MUST** either **fully succeed** or **make no durable publish** of that run’s knowledge changes. **Full success** means: every pending item in scope for the run has its **substantive** content **represented** in the corpus **via** integration that satisfies **Integration (decomposition and placement)** (including **LLM-backed** semantic integration); **`## Sources`** and corpus writes are complete for that integration; **pending** files removed from **`_pending/`** are only those fully integrated in that run; and the clone is **pushed** with the **pin SHA** advanced **as applicable**. The implementation **MUST NOT** ship a **partial** reconcile (some pending integrated and published while others remain silently unaddressed).

**On failure:** If reconcile cannot complete for **any** reason (including **LLM** unavailability or **LLM** invocation failure, other tooling failure, validation, network/push failure, an **irreconcilable** situation **not** covered by **Conflict resolution (incoming knowledge wins)** above, etc.), the implementation **MUST** **bail**: **MUST NOT** push, **MUST NOT** advance the **pin SHA**, **MUST NOT** delete pending files, and **MUST NOT** persist corpus changes **that hide failure** from operators (**no** “partial success” publish). A run that cannot perform **LLM-backed** integration **MUST** fail in this sense—it **MUST NOT** fall back to a non-LLM integration path and treat the run as successful. Callers **MUST** be able to detect failure (for example CLI non-zero exit, MCP tool result **`ok: false`**) so operators are **notified** and can **fix** the underlying issue and retry. **SHOULD** include actionable detail in the error path (for example **`details`** in the MCP error envelope, or stderr/JSON error fields for CLI) when that helps locate the problem.

**Local work:** The implementation **MAY** prepare changes in a working tree or scratch area during the run; **MUST** leave the **authoritative** clone and pin state **unchanged** from the run’s starting point if the run does not reach **full success** (or **MUST** apply an equivalent rollback so no partial publish remains).

---

## Ordering when multiple pending entries apply

Each pending entry has an integer **`addEpoch`** used only to order work within a reconcile run: **ascending** numeric order, with **`0`** meaning **unknown** or unavailable and sorting **after** all positive values. When multiple pending entries are processed in one reconcile run, that ordering **MUST** follow this rule. **`specs/core.md`** defers here (see **Reconciliation** section).

---

## Results, pin lifecycle, and structured fields

When the operation mutates the clone and pushes, the implementation **MUST** advance the **pin SHA** after push (same pin lifecycle as other write flows that advance the pin).

Structured **success** output **MUST** include only paths that reflect a **fully completed** run:

- **`oldSha`** — pin SHA before the operation’s writes/push (as applicable).
- **`newSha`** — pin SHA after successful push when the clone was advanced.
- **`touched`** — paths of corpus files under **`knowledge/`** (and any other paths the product reports) created or updated by this run’s integration; CLI and MCP **MUST** use the **same field names, JSON shapes, and element meanings** for parity.
- **`deleted`** — pending paths removed in that run because they were **fully integrated** (empty if nothing was pending).

There is **no** “partial success” body: if the run does not fully succeed, the product **MUST** use the **failure** path above, not a success payload with leftover work.

**Parity:** **`gl reconcile`** structured output (for example with **`--json`**) **MUST** expose the **same semantic fields** as the MCP tool’s success body for the same **fully successful** reconcile operation, allowing for transport-level wrapping differences.

---

## Errors: `reconciliation_conflict`

Normative structured tool failures use the shared error envelope (**`specs/mcp.md`** — **Error envelope and codes**). The code **`reconciliation_conflict`** is among the normative codes. Because **incoming knowledge wins** over conflicting corpus text (**Conflict resolution (incoming knowledge wins)** above), **`reconciliation_conflict`** is **not** for “corpus vs pending disagree.” Implementations **SHOULD** use **`reconciliation_conflict`** when reconcile fails because integration still cannot be completed—for example **contradictory pending items within the same run** that the product cannot sequence or merge, or another **irreconcilable** semantic situation **not** solvable by editing the corpus toward pending—as opposed to generic external or argument failures—so callers can distinguish **reconcile-specific** integration failures.

---

## Testing and the normative contract

This document **MUST NOT** prescribe **test implementation minutiae** (exact assertions, helper names, or white-box structure). **However**, **tests that only lock deterministic decomposition helpers**—without validating **LLM-backed integration** against the **MUST** themes in this document—are **insufficient** as **contract tests** for reconciliation. The **normative** contract is **semantic** pending→corpus integration **via** **LLM inference**, not endorsement of a particular mechanical pipeline. **Alignment** is against **MUST**s in **this** specification (LLM integration, **`## Sources`**, atomicity, ordering, failure behavior, and related rules here)—not **incidental** implementation details. This section **states** contract scope for tests; it is **not** a testing guide.

---

## Non-goals (clarifying boundaries)

- This spec does **not** define MCP transport, HTTP auth, stdio session wiring, or **`giterloper_merge`** (GitHub merge API); those belong to **`specs/mcp.md`** and related docs.
- It does **not** enumerate **CLI** global flags beyond what **pairing** requires for **`reconcile`**; full CLI invocation rules are in **`specs/cli.md`**.
- It does **not** duplicate **pin semantics**; branched pins and write prerequisites follow **`specs/pin-semantics.md`** and the CLI/MCP slices where write tools require a branch.
