# CRYSTAL Approach + Giterloper: Plan for Self-Organizing Knowledge Growth

This document maps the MIT CRYSTAL approach (agentic self-organizing knowledge graphs) onto giterloper's strengths and proposes concrete extensions that preserve giterloper's design while enabling CRYSTAL-like feedback loops.

---

## Part 1: CRYSTAL Approach (Research Summary)

### Source
- **Paper:** "Agentic Deep Graph Reasoning Yields Self-Organizing Knowledge Networks" (arXiv:2502.13025)
- **Author:** Markus J. Buehler, MIT Laboratory for Atomistic and Molecular Mechanics
- **Related:** PRefLexOR (lamm-mit), Graph-PRefLexOR

### Core Idea
CRYSTAL mimics natural crystal formation: a **nucleus** (initial structure) plus **simple growth rules** produce complex emergent order without top-down design. Applied to knowledge, AI agents iteratively grow a knowledge graph through a feedback loop.

### The Feedback Loop
1. **Reason** — Agent reasons about a topic, producing a reasoning trace.
2. **Extract** — Trace is converted into a sub-knowledge graph (concepts = nodes, relations = edges).
3. **Integrate** — Sub-graph is merged into the main knowledge graph.
4. **Repeat** — Agent reasons again using the updated structure; the cycle continues.

### Mathematical Foundation
- **Category theory:** Objects (concepts), morphisms (relationships), functors (mappings) give formal structure.
- **Complexity theory:** Explains how order emerges from decentralized interactions.

### Emergent Properties (after hundreds of iterations)
- **Hub formation** — Highly connected “hub” concepts.
- **Bridge nodes** — Connect disparate knowledge clusters.
- **Stable modularity** — Knowledge organizes into coherent clusters.
- **Scale-free structure** — Distributed connectivity, no saturation.

### Application
Used for materials design: compositional reasoning, cross-domain synthesis, and novel knowledge beyond summarization.

---

## Part 2: Giterloper Today (What We Leverage)

### Strengths
| Capability | Role in CRYSTAL-style Flow |
|------------|----------------------------|
| **Git-based store** | Versioning, branching, merge; natural “crystal branches” for exploration. |
| **Pin = repo@sha + branch** | Multiple views/experiments; merge reconciles branches. |
| **add / subtract queues** | Decouples “intent” from “integration”; batch processing. |
| **reconcile** | Integrates queued content into `knowledge/` via semantic search + chunking. |
| **QMD search/query** | “Reason using updated structure” — retrieval for next reasoning step. |
| **chunkDocument** | Breaks content into semantic units; analogous to sub-graph nodes. |

### Current Reconcile Behavior
1. Reads `added/` and `subtracts/` markdown files.
2. Chunks content with `chunkDocument` (QMD).
3. For each chunk: runs `qmd search` to find best-matching `knowledge/` path.
4. **Add:** Appends chunk to matched file (or new file if no match).
5. **Subtract:** Removes chunk text from matched file (exact string match).
6. Deletes queue files, commits, pushes, updates pin SHA.

### Gaps vs CRYSTAL
1. **No built-in feedback loop** — Agent must manually: reconcile → search → reason → add → reconcile.
2. **Reconcile = append, not merge** — New content is appended; no consolidation or deduplication.
3. **No “reason-and-add” primitive** — No single step that reasons from current knowledge and enqueues.
4. **No iteration construct** — No `gl iterate` or similar for N cycles.
5. **Subtract uses exact match** — Semantic overlap (e.g., paraphrases) is not handled.

---

## Part 3: Proposed Extensions (Leveraging Giterloper)

### Principle: Extend, Don’t Redesign
- Keep git, pins, add/subtract, reconcile, QMD as-is.
- Add new actions and reconcile variants that layer on top.

---

### 3.1 Reconcile Variants / Modes

#### A. `reconcile --mode append` (default, current behavior)
- Append chunks to best-matching file.
- No change to existing logic.

#### B. `reconcile --mode integrate` (new, optional)
- **Behavior:** Before appending, run semantic search to detect near-duplicates. If a chunk is very similar to existing content, optionally:
  - Skip (avoid redundancy), or
  - Merge via a simple rewrite (e.g., “merge these two paragraphs” prompt).
- **Implementation:** Could use `qmd search` with higher `-n` and similarity threshold; optional LLM/rewrite step for merge.
- **Giterloper fit:** Still operates on `added/` → `knowledge/`; no new folders.

#### C. `reconcile --mode refine` (new, optional)
- **Behavior:** For each chunk, retrieve surrounding context from `knowledge/`, optionally call an LLM to “refine and integrate” (e.g., “integrate this new claim with the following existing content”), then write.
- **Giterloper fit:** Reconcile stays the single integration point; refine is a variant strategy.

**Recommendation:** Start with `--mode append` as the default. Add `--mode integrate` when near-duplicate detection is well-defined. Defer `--mode refine` until there is a clear orchestration story for LLM calls.

---

### 3.2 New Action: `gl grow` (Reason-and-Add)

**Purpose:** One-shot “reason from current knowledge, then add”.

**User flow:**
```text
gl grow --topic "How does X relate to Y?" [--pin <name>] [--name <file>]
```

**System behavior:**
1. Run `gl query "<topic>"` (or `gl search`) to retrieve relevant context.
2. Output context to stdout (or a temp file) for the caller/agent.
3. **Agent** (external, e.g. Cursor/LLM) reasons and produces markdown.
4. Agent pipes that markdown to `gl add`.
5. Agent (or user) runs `gl reconcile`.

**Simpler variant:** `gl grow` only does (1)–(2) and prints instructions: “Reason about the above, then: echo '…' | gl add”. Orchestration lives in the skill or user script.

**Giterloper fit:** Uses existing `query`/`search` and `add`; no new write paths.

---

### 3.3 New Action: `gl iterate` (Feedback Loop)

**Purpose:** Run N cycles of “retrieve → reason → add → reconcile”.

**User flow:**
```text
gl iterate --rounds N [--seed "<query>"] [--pin <name>]
```

**System behavior (per round):**
1. **Seed:** First round uses `--seed` (or a default). Later rounds: derive seed from last round (e.g., “expand on what was added” or a summary of new files).
2. **Retrieve:** `gl query "<seed>"` or `gl search "<seed>"` → context.
3. **Delegate:** Hand context to external agent (script, Cursor skill, etc.).
4. **Add:** Agent produces markdown → `gl add`.
5. **Reconcile:** `gl reconcile`.
6. **Next:** Loop with new seed.

**Branching:** Run `gl iterate` on a topic branch. Compare to main, then `gl merge topic main` to integrate.

**Giterloper fit:** Composes `query`, `add`, `reconcile`; iteration and seeding are orchestration. Can live in skill or a wrapper script.

---

### 3.4 Branching as “Crystal Branches”

**Idea:** Use git branches as exploration directions.

- **main** — Stable, curated knowledge.
- **topic/X** — Exploration on theme X.
- **topic/Y** — Exploration on theme Y.

**Flow:**
1. `gl pin add knowledge <repo> --branch main`
2. `gl stage topic/materials-design`
3. Run several `gl add` + `gl reconcile` cycles on that branch.
4. Compare: `gl search` on main vs on `topic/materials-design`.
5. Merge: `gl merge topic-pin main-pin` when satisfied.

**Giterloper fit:** Uses existing `stage`, `merge`, `promote`. No new primitives needed; documented workflow.

---

### 3.5 Subtract Improvement: Semantic Overlap

**Current:** Subtract removes content by exact string match.

**Gap:** Paraphrases or close variants are not removed.

**Option A (minimal):** Document that subtract is exact-match; user/agent should phrase subtract queue to match source text.

**Option B (extend):** `gl subtract --semantic` — for each chunk in `subtracts/`, run `qmd search`, and for high-similarity matches, remove or flag. Requires similarity threshold and possibly LLM to produce “equivalent” text for removal.

**Recommendation:** Start with Option A. Revisit Option B when there is clear demand and a robust similarity/removal policy.

---

## Part 4: End-to-End Flow (User + System View)

### User Perspective: “Grow Knowledge Crystallographically”

**Setup:**
```bash
gl pin add knowledge github.com/owner/repo --branch main
gl pin update knowledge
gl stage
```

**Single cycle (manual):**
```bash
# 1. Get context
gl query "What do we know about topic X?" -o context.txt

# 2. Reason (external: LLM, Cursor, human) and add
echo "<reasoning trace / new knowledge>" | gl add --name x-expansion

# 3. Integrate
gl reconcile

# 4. Optional: verify
gl search "X"
```

**Automated iteration (future `gl iterate`):**
```bash
gl iterate --rounds 10 --seed "Materials design principles" --pin knowledge
```

**Exploration branch:**
```bash
gl stage topic/materials-exploration
# ... multiple add + reconcile cycles ...
gl merge knowledge-topic knowledge-main   # when ready
```

---

### System Perspective (Behind the Scenes)

**Single cycle:**
1. `query` → QMD over indexed `knowledge/` → context.
2. `add` → Write to `added/<file>.md` in staged clone → commit → push → update pin SHA.
3. `reconcile` → Read `added/` → chunk → `qmd search` per chunk → append to best `knowledge/` path → delete queue files → commit → push → update pin SHA → re-index (via `updatePinSha` → `indexPin`).

**Iteration (with `gl iterate`):**
1. For round i = 1..N:
   - Seed = f(previous round) or `--seed`.
   - `query(seed)` → context.
   - Invoke agent script with context.
   - Agent stdout → `add`.
   - `reconcile`.
   - Optionally re-seed from “what changed” (e.g., diff of knowledge/).
2. Pin SHA advances each round; each round is a commit.

**Branching:**
1. `stage topic/X` → new working clone on branch `topic/X`.
2. All add/reconcile on that clone.
3. `merge` → git merge into main clone → push → update target pin.

---

## Part 5: Implementation Priorities

| Priority | Item | Effort | Value |
|----------|------|--------|-------|
| 1 | Document CRYSTAL-style workflow (this plan + skill) | Low | High |
| 2 | `gl grow` (query → instructions for add) or thin wrapper | Low | High |
| 3 | `gl iterate` script/skill (orchestrate query→add→reconcile) | Medium | High |
| 4 | Branching workflow in SKILL.md / bootstrap | Low | Medium |
| 5 | `reconcile --mode integrate` (near-dup detection) | Medium | Medium |
| 6 | `reconcile --mode refine` (LLM-assisted merge) | High | Medium |
| 7 | `subtract --semantic` | Medium | Low (until proven need) |

---

## Part 6: Technical Anchoring

### Why This Aligns With CRYSTAL

1. **Feedback loop:** `query` → reason → `add` → `reconcile` → `query` mirrors CRYSTAL’s “reason with structure → extract → integrate → reason again”.
2. **Decentralized growth:** Each add is a local “nucleation”; reconcile places it; no central schema.
3. **Emergent structure:** Semantic search + append creates hubs (frequently matched files) and bridges (files that span topics). QMD embeddings approximate graph connectivity.
4. **Branching:** Exploration branches = alternative growth paths; merge = integration of successful branches.

### Why We Don’t Need a Full Graph

CRYSTAL uses explicit nodes/edges. Giterloper uses:
- **Markdown files** as “nodes”
- **Chunking** as granular concepts
- **Semantic search** as “edges” (retrieval links chunks by similarity)
- **File structure** as weak hierarchy

The result is a **retrieval graph** rather than an explicit knowledge graph. For many use cases this is sufficient; explicit graph construction can be a later layer if desired.

---

## Summary

Giterloper can support CRYSTAL-like self-organizing knowledge growth by:
- **Keeping** git, pins, add/subtract, reconcile, QMD.
- **Adding** `gl grow` and `gl iterate` to close the feedback loop.
- **Using** branching as exploration; merge as integration.
- **Extending** reconcile with optional `--mode integrate` / `--mode refine` when needed.

The core loop—retrieve, reason, add, reconcile, repeat—matches CRYSTAL’s feedback mechanism while staying within giterloper’s design.
