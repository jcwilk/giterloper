---
id: git-incv
status: open
deps: [git-6uc2, git-e4x6, git-6g05, git-36ls, git-oox1]
links: []
created: 2026-03-22T00:21:49Z
type: task
priority: 2
assignee: user.email
parent: git-zbfq
---
# Extend .cursor/agents/verifier.md for hierarchy, orthogonality, and strict anchoring

**Focus:** Verifier guidance should steer review of **tickets**, **`specs/*`**, **`tests/`**, and **`lib/`** / **server** changes. **Do not** embed “open or update AGENTS.md / CONVENTIONS.md / mandate / root README” style checklists—**universal law** at repo root is assumed read (**git-36ls** nudges via **AGENTS.md** only). Verifier may describe precedence in terms of **slice specs vs tests vs implementation** without naming root instruction filenames as action targets. Must **not** instruct a **defined workflow** for editing root-level instruction files—those stay **human-directed** (**git-zbfq**).

Update verifier instructions: mandatory consultation of specs/cli.md, specs/core.md, specs/MCP.md for changes in those slices. Reject hierarchical divergence—changes must not conflict with applicable spec text. Root instruction files outrank area specs on overlap except when the user explicitly drives a systemic process change (then specs follow updated root). Flag contradictions between area specs when both apply; treat overlap as allowed only if consistent. docs/ lowest—never let stale docs justify rejecting spec-aligned code; instead require docs updates. Strict: reject **product-behavior** tests that assert behavior with no spec anchor (consistent with **git-oox1** harness carve-out); reject new materially new behavior (agent judgement + repository precedence) lacking spec representation. **Read-only** means the verifier **does not apply fixes**—running tests/commands and **reviewing plan-only commits** is in scope. Encourage optional sleuthing: nearby git history, spec diffs or excerpts in tickets when present—tickets need not explicitly map spec deltas. When judging **plan-only** commits (spec edits + new tickets, no code), treat well-formed tickets as valid alignment artifacts—**APPROVED** is allowed when tickets plausibly cover spec intent **without** requiring green tests as proof of *ticket completion* for that commit shape (full suite may still run per policy). Replace legacy **docs/** examples (e.g. pin path) with **`specs/*`** and single canonical pin location per **git-46zo**. Precedence wording stays **operational** for **spec/test/code** review—**no** duplicate “read root file X” nudges (those live only in **AGENTS.md** after **git-36ls**). **git-oox1** must land first so verifier and **tests/README.md** describe the same anchoring/harness story—**tests/README** also avoids citing root instruction filenames except a single optional deferral line if truly needed.

## Acceptance Criteria

verifier.md updated per above; examples use `specs/*` not removed `docs/PIN_*` paths; **does not** name root instruction files as agent action items; consistent with **tests/README.md** harness/anchoring (**git-oox1**) without duplicating AGENTS nudges; plan-only commit path explicit; still no self-directed fixes beyond verification reporting.

