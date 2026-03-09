# CRYSTAL Approach: Mapping to Giterloper

This document synthesizes research on the MIT CRYSTAL approach and proposes how giterloper can support a similar self-organizing knowledge workflow **without redesigning** the system. It leverages giterloper’s strengths and suggests targeted extensions.

## Executive Summary

**CRYSTAL (MIT)** uses an agentic feedback loop: reason → extract sub-graph from reasoning trace → merge into main graph → formulate next prompt from structure → repeat. Over hundreds of iterations, this yields hub formation, bridging nodes, and stable modularity—without top-down design.

**Giterloper already provides** most building blocks: `add`/`subtract` as reasoning-trace queues, `reconcile` as semantic integration, QMD for "reason again," and git branches for exploration vs. main. The main gap is **prompt formulation from structure** and an **orchestrated loop**.

**Proposed additions:**
- **`gl reflect`** — Query the store for gaps/connections; output a "next reasoning prompt" for the agent.
- **`gl crystallize`** — Automated CRYSTAL loop: add → reconcile → index → reflect → add … for N rounds.
- **`reconcile --dry-run`** — Preview where chunks would land (no writes).
- **`reconcile --rounds N`** — Iterative reconcile with optional prompt-query between rounds.

**Branching:** Use exploration branches (`crystal_<topic>`) for sub-graph accumulation; merge into main when validated. No new storage; all within git + QMD.

---

## 1. CRYSTAL Research Summary

### 1.1 Core Concept

CRYSTAL (MIT) builds **self-organizing knowledge graphs** using AI agents, inspired by natural crystal formation. Instead of top-down design, it uses a nucleus + growth rules so structure emerges from iterations.

**Source:** "Agentic deep graph reasoning yields self-organizing knowledge networks" (Buehler et al., MIT, Journal of Materials Research 2025), arxiv.org/abs/2502.13025, dspace.mit.edu/bitstream/handle/1721.1/163388/, PRefLexOR (github.com/lamm-mit/PRefLexOR).

### 1.2 The Iterative Feedback Loop

At each iteration, the system:

1. **Agent reasons** about a topic.
2. **Reasoning trace** is turned into a sub-knowledge graph (concepts + relationships).
3. **Sub-graph is merged** into the main knowledge graph.
4. **Agent reasons again** using the updated graph to formulate the next prompt.

There is no central planner; structure emerges from repeated local interactions.

### 1.3 Emergent Properties (after hundreds of iterations)

- **Hub formation**: Highly connected central concepts.
- **Bridging nodes**: Nodes linking otherwise disconnected clusters.
- **Stable modularity**: Coherent sub-structures.
- **Open-ended growth**: New nodes/edges without saturation.
- **Distributed connectivity**: Centrality and path distributions become more evenly distributed.

### 1.4 Theoretical Foundations

- **Category theory**: Objects (concepts), morphisms (relationships), functors (transformations).
- **Complexity theory**: Order from decentralized interactions and simple rules.

### 1.5 CRYSTAL vs. GraphRAG / Traditional RAG

- GraphRAG: Pre-extracted entities/relationships, static graph at retrieval time.
- CRYSTAL: Graph is **continuously updated** from agent reasoning; prompts are derived from the evolving structure.
- Giterloper: Vector-indexed Markdown under `knowledge/`; no explicit graph, but semantic structure via QMD embeddings. Its strength is **git-based evolution** and **branching**.

---

## 2. Giterloper Strengths to Leverage

| Strength | How CRYSTAL Can Use It |
|----------|------------------------|
| **Git + branching** | Exploration branches = “sub-graphs”; main = stable knowledge. Merge = integration. |
| **add / subtract queues** | `added/` and `subtracts/` as “reasoning trace” buffers before integration. |
| **reconcile** | Semantic search + placement = graph-like coalescence (place new content near related content). |
| **QMD search/query** | “Reason again using updated graph” = query over re-indexed collection. |
| **Pin + SHA** | Versioning; each integration is a commit; history = growth trace. |
| **merge (pin-to-pin)** | Combine exploration branches into main. |

---

## 3. Gaps and Mapping

### 3.1 Gap: CRYSTAL’s “formulate subsequent prompts”

CRYSTAL derives next prompts from graph structure (e.g., sparse regions, bridges). Giterloper has no equivalent.

**Mapping:** Use `gl query` with gap-style questions (“What is not yet documented about X?” “What connects Y and Z?”). The agent/skill can turn query output into next reasoning prompts. This stays outside `gl` as prompt design; `gl` provides the query surface.

### 3.2 Gap: Explicit graph (nodes + edges)

CRYSTAL uses a graph; giterloper uses Markdown + embeddings.

**Mapping:** Treat the embedding space as a **soft graph**:
- Documents ≈ nodes.
- Semantic similarity ≈ edges.
- Reconcile’s “search → place near match” ≈ linking new nodes to existing ones.
- Structure (hubs, clusters) emerges from repeated reconcile + index cycles.

### 3.3 Gap: “Reasoning trace → sub-graph” extraction

CRYSTAL extracts concepts/relationships from traces. Giterloper’s `add` queues free-form Markdown.

**Mapping:** The agent produces Markdown (chunked by `chunkDocument`) that already encodes the “trace.” Reconcile places it by similarity. A future option could add structured extraction, but it’s not required for CRYSTAL-like behavior.

---

## 4. Proposed Changes to Reconcile

### 4.1 Keep Current Reconcile

Current behavior (chunk → search → append to matched file or create new file) already matches “place new knowledge near related knowledge.” This is the core integration step.

### 4.2 New: `reconcile --iterative` (or `reconcile --rounds N`)

**Purpose:** Run multiple reasoning-integration rounds without user interaction.

**Flow:**
1. Process `added/` and `subtracts/` as today.
2. Re-index (or rely on incremental indexing if QMD supports it).
3. Optionally run a configurable “next prompt” command (e.g., `gl query "..."`).
4. If new content is produced, queue it into `added/` and repeat for N rounds (e.g., N=3).

**Implementation sketch:** Add `--rounds N` and optionally `--prompt-query "<question>"`. Each round: reconcile → index → (if prompt-query) run query and pipe output to `add` → repeat. This creates a simple feedback loop inside `gl`.

### 4.3 New: `reconcile --dry-run` / `reconcile --preview`

**Purpose:** Show where chunks would land without writing.

**Output:** Per chunk: `{ chunkPreview, matchedPath, action: "append"|"create" }`. Useful for debugging and understanding structure before committing.

### 4.4 Optional: `reconcile --structure`

**Purpose:** Encourage more graph-like placement (e.g., concept/relationship extraction).

**Scope:** Deferred. Could use an LLM or structured output to extract (concept, relation, target) and place in `knowledge/concepts/` or similar. Not needed for initial CRYSTAL-style workflow.

---

## 5. New Actions

### 5.1 `gl reflect [--pin <name>] [--topic <topic>]`

**Purpose:** Produce “next reasoning prompt” from the collection (CRYSTAL’s “formulate subsequent prompts”).

**Behavior:**
- Runs one or more `gl query` calls (e.g., “What gaps exist in our knowledge about <topic>?” “What concepts are underconnected?”).
- Outputs a prompt (or JSON) that an agent can use as the next reasoning task.

**Implementation:** Orchestrates `query`; formatting can be a small template. No new indexing; reuses existing `query`.

### 5.2 `gl crystallize [--pin <name>] [--rounds N]`

**Purpose:** One-command CRYSTAL loop: add → reconcile → index → reflect → add … for N rounds, then promote.

**Behavior:**
1. Ensure `added/` has content (or fail with a message).
2. Reconcile.
3. Re-index.
4. For rounds 2..N: run `reflect` → pipe to `add` → reconcile → re-index.
5. Optionally run `promote` at the end.

**Implementation:** Composes existing commands. `--rounds 1` is effectively reconcile + index.

### 5.3 No New Primitives for add/subtract

`add` and `subtract` already queue reasoning traces and retractions. No change needed.

---

## 6. Branching Strategy for CRYSTAL

### 6.1 Branch Roles

| Branch | Role | Operations |
|--------|------|------------|
| `main` | Stable, canonical knowledge | Read-only for agents; updated via merge |
| `crystal_<topic>` or `explore_<id>` | Exploration / sub-graph | add → reconcile → iterate |

### 6.2 Flow

1. Create exploration pin: `gl pin add explore_X <source> --branch crystal_topicX`
2. Stage and work: `gl stage crystal_topicX --pin explore_X`
3. Queue reasoning: `echo "<reasoning trace>" | gl add --pin explore_X`
4. Integrate: `gl reconcile --pin explore_X` (or `gl crystallize --pin explore_X --rounds 5`)
5. Promote exploration: `gl promote --pin explore_X`
6. Merge into main: `gl merge explore_X main_pin` (where `main_pin` points at main)

### 6.3 Parallel Exploration

Multiple pins, each with its own branch (e.g., `crystal_topicA`, `crystal_topicB`). Each accumulates a “sub-graph.” Merge into main when validated. AGENTS.md’s collision rules (RUN_ID, unique branch names) apply.

---

## 7. User and System Flows

### 7.1 User Perspective (Manual CRYSTAL Loop)

```
1. Start exploration:
   gl pin add my_explore <repo> --branch crystal_phase1
   gl clone --pin my_explore && gl index --pin my_explore
   gl stage crystal_phase1 --pin my_explore

2. Reason about a topic (externally or via agent):
   <agent produces markdown reasoning trace>

3. Queue and integrate:
   echo "<trace>" | gl add --pin my_explore
   gl reconcile --pin my_explore

4. Reflect and iterate (optional):
   gl reflect --pin my_explore --topic "materials design"
   <agent uses output as next prompt, produces more trace>
   echo "<trace>" | gl add --pin my_explore
   gl reconcile --pin my_explore

5. Repeat 4 until satisfied, then:
   gl promote --pin my_explore
   gl merge my_explore main_knowledge
```

### 7.2 User Perspective (Automated: `crystallize`)

```
1. Same setup as above (pin, clone, index, stage).

2. Queue initial content:
   echo "<initial reasoning trace>" | gl add --pin my_explore

3. Run automated loop:
   gl crystallize --pin my_explore --rounds 5

4. Review and merge:
   gl promote --pin my_explore
   gl merge my_explore main_knowledge
```

### 7.3 System Perspective (Behind the Scenes)

**Reconcile (current):**
- Read `added/` and `subtracts/`.
- For each file: `chunkDocument` → chunks.
- For each chunk: `qmd search <chunk>` → top matches.
- Added: append to matched file or create new file under `knowledge/`.
- Subtract: remove chunk text from matched file.
- Delete queue files, commit, push, update pin SHA.

**Reconcile --iterative (proposed):**
- Same as above for round 1.
- Re-index.
- For rounds 2..N: run prompt-query → pipe to add → reconcile → re-index.

**Reflect (proposed):**
- Run `gl query "What gaps exist..."` (and similar).
- Format output as next-prompt text or JSON.

**Crystallize (proposed):**
- For i = 1..N: reconcile (with --rounds if iterative) → index.
- Optionally call reflect between rounds and re-add.
- Optionally promote at end.

---

## 8. Technical Grounding

### 8.1 Why This Stays Within Giterloper

- **No new storage model**: Still git + Markdown + QMD.
- **No explicit graph DB**: Embedding space and file placement approximate graph structure.
- **Composable commands**: `reflect` and `crystallize` orchestrate existing `add`, `reconcile`, `query`, `promote`, `merge`.
- **Branching unchanged**: Same pin/branch model; exploration branches are normal branches.

### 8.2 Compatibility

- `reconcile --iterative` and `reconcile --dry-run` are additive flags.
- `reflect` and `crystallize` are new commands; existing workflows unchanged.
- E2E tests: exploration pins and branches already follow AGENTS.md (RUN_ID, collision avoidance).

### 8.3 Limits vs. Full CRYSTAL

- CRYSTAL: Explicit graph with nodes/edges; structure drives prompts.
- Giterloper: Soft graph via embeddings; prompts from `query` output.
- CRYSTAL: Hundreds of iterations; giterloper: N rounds in `crystallize`, or manual loops.
- Emergence (hubs, bridges) is approximate; true scale-free metrics would need extra tooling.

---

## 9. Implementation Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | `reconcile --dry-run` | Low | Debugging, transparency |
| P1 | `gl reflect` | Low | Closes “formulate prompts” gap |
| P2 | `gl crystallize` | Medium | One-command CRYSTAL loop |
| P3 | `reconcile --rounds N` | Medium | Iterative integration |
| P4 | `reconcile --structure` | High | Explicit graph-style placement (optional) |

---

## 10. References

- Buehler, M.J. et al., "Agentic deep graph reasoning yields self-organizing knowledge networks," *Journal of Materials Research* (2025). https://link.springer.com/article/10.1557/s43578-025-01652-1
- arXiv: https://arxiv.org/html/2502.13025v1
- MIT DSpace: https://dspace.mit.edu/bitstream/handle/1721.1/163388/
- PRefLexOR: https://github.com/lamm-mit/PRefLexOR
- Blog summary: https://atalupadhyay.wordpress.com/2025/03/03/building-self-organizing-knowledge-graphs-with-ai-agents-the-crystal-approach/
