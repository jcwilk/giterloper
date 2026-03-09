# CRYSTAL Approach Planning: Giterloper Adaptation

This document outlines how giterloper can be adapted to achieve effects similar to MIT's CRYSTAL approach (self-organizing knowledge graphs via AI agents) while leveraging its existing strengths. It is grounded in web research and the current gl.mjs implementation.

---

## 1. What CRYSTAL Is (Research Summary)

### Core Concept

The CRYSTAL approach, developed at MIT (Buehler lab, LAMM), enables AI agents to build **self-organizing knowledge graphs** through iterative integration, inspired by how crystals form in nature. Key sources:

- **Agentic Deep Graph Reasoning** (arXiv:2502.13025, Journal of Materials Research): Couples a reasoning-capable LLM with a continually updated graph representation in a feedback-driven loop.
- **Graph-PReFLexOR**: Category-theoretic structure (nodes = concepts, edges = relationships); supports "knowledge garden growth" across domains.

### The Feedback Loop

1. **Agent reasons** about a topic (using current knowledge as context).
2. **Reasoning trace** is converted into a sub-knowledge graph (concepts + relationships).
3. **Sub-graph is integrated** into the main knowledge graph.
4. **Agent reasons again** using the updated graph to formulate subsequent prompts.

This cycle runs hundreds of times. Emergent properties include:

- **Hub formation**: Highly connected central concepts.
- **Stable modularity**: Organized knowledge clusters.
- **Bridging nodes**: Links between disparate domains.
- **Growth without saturation**: New nodes and edges keep appearing.

### Technical Distinctions

- **Not static**: Unlike conventional RAG, the knowledge structure evolves at each iteration.
- **Not single-pass**: Reasoning is introspective and reflective; the model validates and refines using its own outputs.
- **Structure-aware**: Nodes and edges are composable; category theory enables higher-level abstractions across domains.

---

## 2. Giterloper's Current Architecture (Strengths to Leverage)

### Data Model

| Component       | Location                  | Role                                      |
|----------------|---------------------------|-------------------------------------------|
| Pins           | `.giterloper/pinned.yaml` | repo, sha, optional branch                |
| Read-only clone| `.giterloper/versions/`   | Exact SHA for search/query                |
| Working clone   | `.giterloper/staged/`     | Branched write ops (add, subtract, etc.)  |
| Knowledge      | `knowledge/` in clone     | Markdown files; QMD indexes this only     |
| Queues         | `added/`, `subtracts/`    | Unindexed; reconciled into `knowledge/`  |

### Current Write Flow

1. **add** / **subtract**: Read stdin (markdown), write to `added/` or `subtracts/`, commit, push.
2. **reconcile**: For each queued file:
   - Chunk via `chunkDocument` (QMD).
   - For each chunk: `qmd search` in `knowledge/` → pick best match.
   - **Add**: Append chunk to matched file (or create new); add `<!-- reconciled from added/X -->`.
   - **Subtract**: Remove chunk from matched file (string replace).
3. **promote**: Commit staged, push, update pin SHA, re-clone, re-index.

### Current Read Flow

- **search** / **query**: QMD over `knowledge/` collection (`<pin>@<sha>`).
- **get**: Retrieve full file by path.

### Strengths for CRYSTAL-Like Use

| Strength              | CRYSTAL analogue                          |
|-----------------------|-------------------------------------------|
| Git versioning        | Iteration history; rollback; provenance  |
| Branching             | Topic isolation; sub-graph as branch      |
| Semantic search (QMD) | Chunk-to-chunk similarity ≈ edge finding |
| Queue then reconcile  | Reasoning trace → queue → integration     |
| Multiple pins         | Sub-stores or topic branches              |
| Staged working clone  | Agent reasons in isolation, then merges   |

---

## 3. Gaps and Adaptation Strategy

### Gaps

1. **Flat integration**: Reconcile appends to "best match" or creates new files; no explicit node/edge or relationship structure.
2. **No topic-scoped iteration**: No built-in "reason on topic X, integrate, repeat" loop.
3. **No structured reasoning trace**: add/subtract accept raw markdown; CRYSTAL expects concepts + relationships.
4. **Single placement strategy**: One `chooseMatchedKnowledgePath`; no modes for nucleus growth vs. merge vs. bridge.

### Strategy: Extend, Don’t Replace

- Keep `add` / `subtract` as the primary "reasoning output" intake.
- Add **reconcile modes** and optional **structure hints** instead of a full graph layer.
- Use **topic branches** (existing pin/branch model) for sub-graph isolation.
- Define a **feedback loop** as a documented process, not a new subsystem.

---

## 4. Proposed Changes

### 4.1 Reconcile Modes

Extend `gl reconcile` with a `--mode` flag:

| Mode        | Behavior                                                      | CRYSTAL role              |
|-------------|----------------------------------------------------------------|---------------------------|
| `append`    | Current: chunk, search, append to best match or new file      | Default; general growth   |
| `nucleus`   | Create new topic file(s) from chunks; minimal search placement | Seed new clusters         |
| `merge`     | Prefer updating existing files; avoid new files when possible  | Strengthen hubs           |
| `bridge`    | When chunk relates two topics, place in both or in a "bridge" file | Bridging nodes    |

**Implementation sketch**: `--mode` selects different placement logic; `chooseMatchedKnowledgePath` and target-selection get mode-aware variants. Nucleus could use `--name` or first-chunk topic extraction to derive a new path.

### 4.2 Reconcile Variants

| Variant              | Purpose                                                |
|----------------------|--------------------------------------------------------|
| `reconcile --dry-run` | Emit where each chunk would go (JSON); no writes       |
| `reconcile --topic <name>` | Scope search/placement to `knowledge/<topic>/`   |

`--dry-run` supports agent introspection before committing. `--topic` allows topic-scoped integration.

### 4.3 New or Extended Actions

| Action          | Description                                                    |
|-----------------|----------------------------------------------------------------|
| **reflect**     | `query` + `verify` on the answer; optionally queue correction as add/subtract. Closes the introspective loop. |
| **reason-add**  | Alias/workflow: accept reasoning trace, optionally parse "topic: X, related: Y" frontmatter, call add + reconcile with mode. |

`reflect` can be a script or a small gl subcommand that chains query → verify → optional add/subtract. `reason-add` could be a thin wrapper or documented workflow.

### 4.4 Topic Branches (Existing Machinery)

Use branches for topic-scoped "sub-graphs":

```
main                    # canonical knowledge
topic/materials-design  # agent reasons on materials, accumulates added/
topic/compositional-X   # another topic branch
```

**Process**:

1. `gl pin add knowledge_topic_materials <repo> --branch topic/materials-design`
2. Agent reasons on materials, runs `gl add`, `gl reconcile --topic materials`
3. When satisfied: `gl merge knowledge_topic_materials knowledge` (main pin)
4. Main branch gets the integrated topic; index updates on promote.

No new primitives; uses existing `stage`, `merge`, `promote`.

---

## 5. User Flow: CRYSTAL-Like Loop

### From the User’s Perspective

1. **Ask**: "What do we know about compositional design of materials?"
2. **Agent**: Runs `gl query "…"`, gets answer + citations.
3. **Agent reasons**: Produces a markdown reasoning trace (possibly with structure hints).
4. **Agent queues**: `echo "<trace>" | gl add --pin knowledge --name reasoning_001`
5. **Agent integrates**: `gl reconcile --pin knowledge [--mode nucleus|merge|append] [--topic X]`
6. **Agent promotes**: `gl promote --pin knowledge` (or rely on auto-index on next read).
7. **Repeat**: Go to step 1 with a refined or new question; knowledge has grown.

For **topic-focused iteration**:

- Create a topic branch, run steps 3–6 there, then merge into main when ready.

### From the System’s Perspective

1. **add**: Writes markdown to `added/<file>.md` in staged clone; commits and pushes.
2. **reconcile**:
   - Reads `added/` and `subtracts/`.
   - Chunks each file via `chunkDocument`.
   - For each chunk: `qmd search` in `knowledge/` → select target path (mode-dependent).
   - Writes to `knowledge/` (append, create, or update).
   - Removes processed queue files; commits and pushes.
3. **promote**: Pushes staged branch, updates pin SHA, re-clones at new SHA, re-indexes.
4. **query/search**: QMD retrieves from `knowledge/` at current pin SHA.

The feedback loop is: **retrieve (query)** → **reason (external)** → **queue (add)** → **integrate (reconcile)** → **materialize (promote)** → **retrieve again**. The "graph" is implicit in the folder layout and chunk placement; structure emerges from where chunks land and accumulate.

---

## 6. Implementation Priorities

### Phase 1 (Low effort)

- Add `reconcile --dry-run` (no writes, output placement as JSON).
- Document the CRYSTAL-like feedback loop in SKILL.md and bootstrap.
- Add `--topic` to reconcile to scope placement under `knowledge/<topic>/`.

### Phase 2 (Medium effort)

- Add `--mode` to reconcile (`append` default, `nucleus`, `merge`, `bridge`).
- Implement `reflect` as a script or subcommand (query + verify + optional queue).

### Phase 3 (Optional)

- `reason-add` wrapper with optional frontmatter parsing.
- Richer structure hints (e.g. `topic:`, `relates-to:` in frontmatter) to guide placement.

---

## 7. Technical Notes

### Relationship to Category Theory

CRYSTAL uses category theory for formal structure. Giterloper can approximate this without a full graph:

- **Objects**: Markdown files (or chunks) as "concepts."
- **Morphisms**: Semantic similarity (QMD search) and co-occurrence in files.
- **Functors**: Reconcile modes (nucleus, merge, bridge) as mappings from queue → knowledge layout.

Folder hierarchy + semantic search gives an implicit graph; explicit nodes/edges can be added later if needed.

### Index Lifecycle

Per AGENTS.md: `updatePinSha` and `cmdPinAdd` manage indices. After reconcile + promote, the new SHA is indexed automatically. No change required for the feedback loop.

### Concurrent Safety

Topic branches are isolated; each has its own staged clone. `mutatePins` and lock files protect pinned.yaml. Same collision-avoidance rules for E2E (unique pin/branch names) apply.

---

## 8. Summary

| CRYSTAL Element          | Giterloper Leverage                                  |
|-------------------------|------------------------------------------------------|
| Reasoning trace         | Stdin to `add`; markdown in `added/`                  |
| Sub-graph               | Topic branch or `--topic`-scoped reconcile            |
| Integration             | `reconcile` with modes (append, nucleus, merge, bridge) |
| Updated context         | `promote` → new SHA → re-index → `query` sees new content |
| Iteration               | Documented loop: query → add → reconcile → promote   |
| Bridging                | `--mode bridge` or cross-file references in markdown |
| Emergent structure      | Folder layout + chunk placement + semantic similarity |

The main shift is treating reconcile as a **configurable integration step** (modes, dry-run, topic scope) and the feedback loop as a **process** built from existing commands, rather than redesigning the system. Git, branching, QMD, and the queue model already provide the substrate; the rest is careful extension and documentation.
