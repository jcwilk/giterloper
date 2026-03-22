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

Outcomes (child tickets decompose order):

- **Mandate:** `HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md` defines the multi-layer model: **root instruction markdown** (e.g. AGENTS.md, CONVENTIONS.md) vs **per-area specs** under `specs/` vs **tests** vs **implementation**; vocabulary **hierarchical alignment** vs **hierarchical divergence**; git history (not spec changelogs) as the journal; **~2-page** skim target per area spec with optional new `specs/*` + matching `tests/*` subtree when a domain outgrows that.
- **Orthogonality:** Universal agent/process/coding standards live in root instruction files; product behavior for a slice lives in that slice’s spec. **Surface overlap explicitly**; **area specs generally conform to root**; **change root instructions only for user-requested systemic/process change**.
- **Area specs:** `specs/cli.md`, `specs/core.md`, `specs/MCP.md` — deduplicated, not test-shaped layouts. **Strict initial anchoring:** every theme exercised under `tests/cli`, `tests/core`, `tests/mcp` must appear in the matching area spec. **Ongoing:** if it does not deserve spec space, it does not get a test; **spec edits only in task scope** (no drive-by spec churn).
- **Pin semantics:** consolidated into **exactly one** of the three area specs with an **explicit decision tree** (CLI vs MCP, session vs named pins, ref/branch); see **git-46zo**.
- **MCP:** normative contract moves from root **MCP.md** to **`specs/MCP.md`** as hierarchy top for that slice (**not** a quick agent cheat sheet—tool descriptions/runtime carry progressive discovery). See **git-6g05**.
- **docs/:** **Minimal** product definition; **lowest** layer—on conflict, **update docs** to match specs/code. **git-46zo** trims superseded product docs; **git-qna1** audits kept deployment guides for staleness.
- **Commits:** **Planning commits** = spec/mandate edits **and** new tickets **only**—**never** mixed with code/test implementation in the same commit (implementation closes in separate commits). Spec-change subagent (**git-rm4l**) bundles spec+tickets and runs verifier before completion (**git-incv**).
- **Tooling docs:** Update **AGENTS.md**, root **README.md**, **tests/README.md**, and **`.cursor/agents/verifier.md`**; add human-driven **spec-change** subagent (**git-rm4l**).

