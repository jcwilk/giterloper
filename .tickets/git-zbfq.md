---
id: git-zbfq
status: open
deps: []
links: []
created: 2026-03-22T00:21:30Z
type: epic
priority: 2
assignee: user.email
---
# Epic: Hierarchical truth (root instructions, area specs, tests, code)

**Where structured process applies:** The repeatable machinery (**file-tickets**, spec-change + verifier planning commits, strict spec↔test anchoring, alignment tickets) targets **`.tickets/`**, **`specs/`**, **`tests/`**, and **`lib/`** (plus MCP server sources alongside the library—**server/code**). **Do not** extend that machinery to **root-level** instruction or onboarding markdown (**AGENTS.md**, **CONVENTIONS.md**, root **README.md**, etc.): those change **rarely**, only when a **human** asks, and are **manually** ordered—agents should not assume a ticket/spec-change workflow for them. This epic still includes **one-time** tickets (**git-9btr**, **git-36ls**, **git-mpl2**) to align those root files with the new model; that is **project bootstrap**, not a template for ongoing agent process.

Outcomes (child tickets decompose order):

- **Mandate:** `HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md` defines the multi-layer model: **root instruction markdown** (e.g. AGENTS.md, CONVENTIONS.md) vs **per-area specs** under `specs/` vs **tests** vs **implementation**; vocabulary **hierarchical alignment** vs **hierarchical divergence**; git history (not spec changelogs) as the journal; **~2-page** skim target per area spec with optional new `specs/*` + matching `tests/*` subtree when a domain outgrows that.
- **Orthogonality:** Universal agent/process/coding standards live in root instruction files; product behavior for a slice lives in that slice’s spec. **Surface overlap explicitly**; **area specs generally conform to root**; **change root instructions only for user-requested systemic/process change**.
- **Area specs:** `specs/cli.md`, `specs/core.md`, `specs/MCP.md` — deduplicated, not test-shaped layouts. **Strict initial anchoring:** every theme exercised under `tests/cli`, `tests/core`, `tests/mcp` must appear in the matching area spec. **Ongoing:** if it does not deserve spec space, it does not get a test; **spec edits only in task scope** (no drive-by spec churn).
- **Pin semantics:** consolidated into **exactly one** of the three area specs with an **explicit decision tree** (CLI vs MCP, session vs named pins, ref/branch); see **git-46zo**.
- **MCP:** normative contract moves from root **MCP.md** to **`specs/MCP.md`** as hierarchy top for that slice (**not** a quick agent cheat sheet—tool descriptions/runtime carry progressive discovery). See **git-6g05**.
- **docs/:** **Minimal** product definition; **lowest** layer—on conflict, **update docs** to match specs/code. **git-46zo** trims superseded product docs; **git-qna1** audits kept deployment guides for staleness.
- **Commits:** **Planning commits** (spec-change / **file-tickets** alignment path) = **`specs/*`** edits **and** new/updated **`.tickets/*.md` only**—**never** mixed with implementation code or **test file** changes in the same commit (those close under their own tickets). **file-tickets** must treat **uncommitted `specs/*` diff** as **first-class context** with the invoking conversation; stage **all** such spec paths used in that filing **with** the produced tickets—no tickets-only commit that drops the spec delta. If the human **explicitly** included edits to **`HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md`** in the same spec-change request, include that root file in the same planning commit; otherwise **do not** bundle root files by default—root doc edits stay **human-managed** outside this flow. Spec-change subagent (**git-rm4l**) implements the **specs + tickets** bundle (and optional mandate when requested) and runs verifier before completion (**git-incv**).
- **Tooling docs (mixed):** **`tests/README.md`** and **`.cursor/agents/verifier.md`** sit with **tests/** and **agent tooling**—still delivered by tickets but part of the **structured** side where it affects spec↔test behavior. **AGENTS.md** and root **README.md** are **one-time epic alignment** (**git-36ls**, **git-mpl2**); treat as **manual / human-directed** thereafter. Add human-driven **spec-change** subagent (**git-rm4l**).

