## Installation steps

STOP! IMPORTANT!

DO NOT START ACTUAL INSTALLATION UNTIL YOUR USER HAS CONFIRMED FROM THE PREAMBLE AND BEEN GIVEN THE OPPORTUNITY TO OVERRIDE DEFAULTS.

### 1. Ensure prerequisites

Content is accessed via a depth=1 clone and searched with QMD. Check availability:

1. **git** (required): Run `git --version`. Install via system package manager if needed.
2. **Node.js >= 22 or Bun >= 1.0:** Run `node --version` or `bun --version`. QMD requires one of these.
3. **QMD:** Run `qmd status`. If not installed: `npm install -g @tobilu/qmd` (or `bun install -g @tobilu/qmd`). Treat the output as an initial health check, not just an install check: if it already shows `GPU: none` on a machine with NVIDIA hardware, or prints `CMake Error ... CUDA Toolkit not found`, investigate before continuing.
4. **GPU acceleration (recommended):** QMD uses local ML models via `node-llama-cpp`. CPU-only inference works, but `qmd query`, `qmd vsearch`, and `qmd embed` will be much slower. Check hardware and acceleration support:

   ```sh
   # Check for GPU hardware
   lspci | grep -iE 'vga|3d|display'

   # If NVIDIA hardware is present, check the driver
   nvidia-smi

   # If the NVIDIA driver works, check for the CUDA Toolkit
   nvcc --version

   # If no NVIDIA GPU is present, check for Vulkan support as a fallback backend
   vulkaninfo --summary 2>/dev/null
   ```

   Follow this decision tree:

   - **No NVIDIA GPU detected:** Proceed CPU-only unless Vulkan is available. Tell the user that model-backed commands will be slower without GPU acceleration.
   - **NVIDIA GPU detected but `nvidia-smi` fails:** Stop and tell the user the machine has NVIDIA hardware but no working driver. Provide install guidance such as `sudo apt install nvidia-driver-XXX` or the distro-specific equivalent. Wait for the user to confirm the driver is installed, then re-run the checks.
   - **NVIDIA GPU detected, `nvidia-smi` works, but `nvcc` is missing:** Stop and tell the user the CUDA Toolkit is missing. `node-llama-cpp` needs it to compile llama.cpp with CUDA support. Provide install guidance such as `sudo apt install nvidia-cuda-toolkit` or the official NVIDIA CUDA Toolkit installer. Wait for the user to confirm installation, then re-run the checks.
   - **NVIDIA GPU detected, `nvidia-smi` works, and `nvcc` works:** Proceed. CUDA acceleration should be available.

   If the machine has no usable GPU backend and the user explicitly wants to continue CPU-only, note that choice before proceeding.
5. **QMD acceleration health check:** After QMD is installed and the GPU prerequisite checks above are satisfied, run `qmd status` again and inspect the `Device` section.

   - If it shows `GPU: CUDA (...)` or another expected accelerated backend such as Vulkan, proceed.
   - If it shows `GPU: none (running on CPU ...)` on a machine with no usable GPU backend, note that this is expected and proceed.
   - If it shows `GPU: none` even though the machine has NVIDIA hardware, a working driver, and a working CUDA Toolkit, clear any cached failed `node-llama-cpp` build and retry:

     ```sh
     npx --yes node-llama-cpp clear
     qmd status
     ```

     If QMD still reports CPU-only execution, report the diagnostics to the user before continuing.

   At any point during setup, if any `qmd` command emits `CMake Error ... CUDA Toolkit not found`, treat that as a failed CUDA backend build attempt. Revisit the GPU prerequisite step instead of ignoring the warning.

### 2. Create the giterloper directory and pinned.yaml

Create the giterloper root directory (default `.giterloper/`) and add a `pinned.yaml` file that maps this store's name to its reference. Pins **must** use full commit SHAs — never branch names or tags.

Resolve the SHA from the user's chosen ref:

```sh
SHA=$(git ls-remote https://<source> <human-ref> | cut -f1)
```

Then write the pin:

```yaml
# .giterloper/pinned.yaml
<name>: <source>@<sha>
```

For example:

```yaml
giterloper: github.com/jcwilk/giterloper@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

The `<name>` is the human-friendly identifier chosen in the preamble. It determines the subdirectory name under `versions/`. The first entry in `pinned.yaml` is the default store for operations.

### 3. Add .gitignore entries for versions and staged

Add the `versions/` and `staged/` subdirectories (not the entire giterloper root) to `.gitignore` so that cloned store content stays out of version control while `pinned.yaml` remains committed:

```
.giterloper/versions/
.giterloper/staged/
```

Or the equivalent paths if the user chose a different giterloper root.

### 4. Add a giterloper section to the project README

Add a section to the target project's README (or equivalent documentation entry point) so that any agent encountering the project knows giterloper connections exist and how to materialize them. Use the user-confirmed giterloper root path throughout. Template:

```markdown
## Giterloper knowledge stores

This project uses [Giterloper](https://github.com/jcwilk/giterloper) knowledge stores. Store connections are defined in `<giterloper-root>/pinned.yaml`. Each entry maps a name to a store reference:

    <name>: <source>@<sha>

The value is split at the last `@` sign. Everything before it is the **source** (a Git-hostable path such as `github.com/owner/repo`). Everything after it is a full commit **SHA** (40 hex characters). Pins always use exact SHAs for reproducibility.

Cloned stores live under `<giterloper-root>/versions/` and are gitignored. To materialize them, for each entry in `pinned.yaml`:

    git clone --depth 1 https://<source> <giterloper-root>/versions/<name>/<sha>
    git -C <giterloper-root>/versions/<name>/<sha> checkout <sha>

Then follow the `INSTRUCTIONS.md` inside each clone to set up QMD indexing. Write operations use a separate `<giterloper-root>/staged/` directory (also gitignored) for temporary working clones.
```

Replace `<giterloper-root>` with the actual path (e.g. `.giterloper`). The goal is just enough information for an agent to find `pinned.yaml`, parse it, and reify the gitignored clones without any prior knowledge of giterloper.

### 5. Clone the knowledge store

Follow the clone procedure in this store's `INSTRUCTIONS.md`. That file is the canonical source for clone commands, paths, and layout — it will evolve as the store evolves. The clone destination should be `<giterloper-root>/versions/<name>/<sha>/` matching the entry in `pinned.yaml`. The SHA was resolved in step 2.

Moving forward, use the `CONSTITUTION.md`, `INSTRUCTIONS.md`, and `bootstrap/` from that checked-out version to avoid GitHub API limits.

### 6. Set up QMD (present commands; do not auto-run)

See this store's `INSTRUCTIONS.md` about how to index a new checked-out version into QMD. When presenting or following that setup, handle QMD state explicitly instead of treating it as a binary "installed or not" dependency.

Before adding the collection, inspect existing QMD collections:

```sh
qmd collection list
```

- If a collection named `<name>@<sha>` already exists for the exact SHA being set up, stop and ask the user whether to:
  - **Purge and rebuild** the existing index (`qmd collection remove <name>@<sha>`) and recreate it from scratch, or
  - **Keep the existing index** and skip re-adding that collection.
- If the same store name already exists at a different SHA (for example `<name>@<other-sha>`), tell the user that another version is already indexed and ask whether they want to leave it alongside the new version or tear it down.
- Do not silently remove or reuse a colliding collection. Wait for the user's answer before proceeding.

During setup:

1. Add the collection and context as described in `INSTRUCTIONS.md`.
2. Run `qmd embed`.
3. Run `qmd status` and verify that the collection's `Vectors` count is non-zero and roughly matches the `Documents: Total` count. If vectors are missing or much lower than expected, the embeddings may not have been generated for the collection you just added. Re-check for a stale or colliding collection and consider purging and rebuilding it.
4. Use `qmd search "<topic>" -c <name>@<sha>` for quick sanity checks. Prefer this over `qmd query` during initial setup because it does not require model downloads.
5. Proactively trigger model downloads before declaring setup complete. Tell the user that the first model-backed query downloads about 2 GB of models, then run a small test query with a long timeout:

   ```sh
   qmd query "test" -c <name>@<sha> --json
   ```

   Expect the first run to take time because it may download the query expansion model and reranker. Use a generous timeout, inform the user about the download, and retry if the first attempt times out.

### 7. Surface operations to agents

Implement the surface method chosen during the preamble. The goal is to give agents working in the target project clear instructions for discovering and invoking the knowledge store's operations.

**Key principles:**

- **One entry per operation.** Each operation is surfaced individually — never bundled into a single combined entry.
- **`gl` prefix namespacing.** Operations use a `gl_` prefix (underscores) in prose and AGENTS.md headings, and `gl-` prefix (hyphens) in skill folder/skill names (per the Agent Skills naming spec: lowercase letters, numbers, and hyphens only).
- **First pinned item.** The operations always target the first entry in `pinned.yaml` as the default store. Use its `<name>` and `<sha>` throughout.
- **Read by default.** Only include write operations if the user opted in during the preamble.

The store's `INSTRUCTIONS.md` is the canonical reference for how each operation works — adapt its content into the per-operation format the user chose.

If the user chose **custom documentation**, follow their instructions exactly. Still surface each operation separately with `gl` namespacing unless the user explicitly directs otherwise. Skip the templates below.

#### Read operations (always included)

| `gl` name | Operation | Purpose |
|-----------|-----------|---------|
| `gl_answer_from_context` | `answer_from_context` | Answer a question using only knowledge store content |
| `gl_retrieve_relevant_context` | `retrieve_relevant_context` | Retrieve and summarize relevant background information |
| `gl_verify_claim` | `verify_claim` | Check whether a claim is supported, contradicted, or not addressed |

#### Write operations (only if opted in)

| `gl` name | Operation | Purpose |
|-----------|-----------|---------|
| `gl_add_knowledge` | `add_knowledge` | Add new knowledge and reconcile with existing content |
| `gl_subtract_knowledge` | `subtract_knowledge` | Remove knowledge that overlaps with passed content |
| `gl_intersect_knowledge` | `intersect_knowledge` | Keep only knowledge that overlaps with passed content |

---

#### Option A: AGENTS.md

Add a giterloper section to the project's `AGENTS.md` (create the file if it doesn't exist). Each operation gets its own `###` heading with the `gl_` prefixed name. Use the user-confirmed giterloper root path, store name, and SHA throughout.

Start with a brief preamble, then add one section per selected operation.

Template preamble:

```markdown
## Giterloper knowledge store

This project is connected to a [giterloper](https://github.com/jcwilk/giterloper) knowledge store. Store connections are defined in `<giterloper-root>/pinned.yaml`.

If the store is not materialized locally, clone and index it following the instructions in the project README's giterloper section.
```

Then for each selected operation, add a section like the following. Only include the sections for operations the user selected.

**gl_answer_from_context:**

```markdown
### gl_answer_from_context

Answer a question using only content from the knowledge store. Use for grounded, authoritative answers without adding outside knowledge.

1. Run `qmd query "<question>" -c <name>@<sha> --json` or `qmd search "<keywords>" -c <name>@<sha> --json -n 10`.
2. Use `qmd get "<path>" -c <name>@<sha> --full` for deeper context on promising results.
3. Compose an answer from retrieved content only. Cite file paths and headings.
```

**gl_retrieve_relevant_context:**

```markdown
### gl_retrieve_relevant_context

Retrieve and summarize the most relevant information from the knowledge store for a given query. Use when you need background or source material before reasoning.

1. Run `qmd search` or `qmd query` for 5–10 results. Run multiple searches if the query spans topics.
2. Use `qmd get` for broader context when needed.
3. Return a concise summary and/or key excerpts with file paths and headings.
```

**gl_verify_claim:**

```markdown
### gl_verify_claim

Evaluate whether a claim is supported, contradicted, or not addressed by the knowledge store. Use for fact-checking or validation.

1. Extract key concepts as keywords.
2. Run `qmd search` or `qmd query` broadly; try synonyms in separate searches.
3. Check multiple results for supporting and contradicting evidence.
4. Report supported / contradicted / not addressed with citations.
```

If write operations are enabled, also add the following sections. Write operations use the `staged/` directory for working clones and promote to SHA-pinned versions after a successful push (see INSTRUCTIONS.md for the full workflow).

**gl_add_knowledge:**

```markdown
### gl_add_knowledge

Add new knowledge to the store and reconcile it with existing content. Accepts knowledge as a raw string or asset reference.

1. If an asset reference: clone that version if not present, add its QMD collection.
2. Scan for topical overlap: `qmd search "<topic>" -c <name>@<sha> --json`.
3. Create a staged working clone in `<giterloper-root>/staged/<name>/<branch-name>/` on a new branch (see INSTRUCTIONS.md write operations workflow).
4. Place content in the best-fitting location(s). Create new topic-named folders if none fit.
5. Consider structure: merge, split, or rename for clarity.
6. Commit, push, promote to SHA-pinned version under `versions/`, update `pinned.yaml` (new SHA at top), and notify the user.
```

**gl_subtract_knowledge:**

```markdown
### gl_subtract_knowledge

Remove from the store all knowledge that overlaps with the passed content.

1. If an asset reference: clone that version if not present, add its QMD collection.
2. Extract keywords and find overlapping content: `qmd search "<keywords>" -c <name>@<sha> --json`. Compare semantically.
3. Create a staged working clone and branch.
4. Remove overlapping content. Delete empty files or folders.
5. Commit, push, promote to SHA-pinned version, update `pinned.yaml` (new SHA at top), and notify the user.
```

**gl_intersect_knowledge:**

```markdown
### gl_intersect_knowledge

Remove from the store all knowledge that does *not* overlap with the passed content. Only content that overlaps is kept.

1. If an asset reference: clone that version if not present, add its QMD collection.
2. Extract keywords and identify overlapping vs non-overlapping content.
3. Create a staged working clone and branch.
4. Remove non-overlapping content. Consolidate folders as needed.
5. Commit, push, promote to SHA-pinned version, update `pinned.yaml` (new SHA at top), and notify the user.
```

---

#### Option B: Agent Skills (open standard)

Create a **separate skill folder per operation** under `.agents/skills/`. Each folder is named with the `gl-` prefix and hyphens (per the Agent Skills naming spec). Each contains its own `SKILL.md` with YAML frontmatter.

Skill folder layout (read operations):

```
.agents/skills/
├── gl-answer-from-context/
│   └── SKILL.md
├── gl-retrieve-relevant-context/
│   └── SKILL.md
└── gl-verify-claim/
    └── SKILL.md
```

If write operations are enabled, also create:

```
.agents/skills/
├── gl-add-knowledge/
│   └── SKILL.md
├── gl-subtract-knowledge/
│   └── SKILL.md
└── gl-intersect-knowledge/
    └── SKILL.md
```

Templates for each skill (adapt store name, SHA, and giterloper root as needed):

**`.agents/skills/gl-answer-from-context/SKILL.md`:**

```markdown
---
name: gl-answer-from-context
description: "Answer a question using only the giterloper knowledge store. Use when you need a grounded, authoritative answer without outside knowledge or assumptions."
---

# gl-answer-from-context

Answer a question using only content from the <name> giterloper knowledge store.

## When to use

- When you need an authoritative answer grounded in the knowledge store
- When the user asks a question that should be answered from stored knowledge only
- When you need to avoid introducing outside assumptions

## Prerequisites

- The store must be cloned and indexed. If `<giterloper-root>/versions/<name>/<sha>/` does not exist, follow the project README's giterloper section to materialize it.
- QMD must be installed and the collection registered (`qmd collection list` should show `<name>@<sha>`).

## Instructions

1. Run `qmd query "<question>" -c <name>@<sha> --json` or `qmd search "<keywords>" -c <name>@<sha> --json -n 10`.
2. Use `qmd get "<path>" -c <name>@<sha> --full` for deeper context on promising results.
3. Compose an answer from retrieved content only. Cite file paths and headings.
```

**`.agents/skills/gl-retrieve-relevant-context/SKILL.md`:**

```markdown
---
name: gl-retrieve-relevant-context
description: "Retrieve and summarize relevant information from the giterloper knowledge store. Use when you need background or source material before reasoning or answering."
---

# gl-retrieve-relevant-context

Retrieve and summarize the most relevant information from the <name> giterloper knowledge store.

## When to use

- When you need background context or source material from the store
- When you need to gather information before reasoning about a topic
- When the user asks for a summary of what the knowledge store contains on a topic

## Prerequisites

- The store must be cloned and indexed. If `<giterloper-root>/versions/<name>/<sha>/` does not exist, follow the project README's giterloper section to materialize it.
- QMD must be installed and the collection registered (`qmd collection list` should show `<name>@<sha>`).

## Instructions

1. Run `qmd search` or `qmd query` for 5–10 results. Run multiple searches if the query spans topics.
2. Use `qmd get "<path>" -c <name>@<sha> --full` for broader context when needed.
3. Return a concise summary and/or key excerpts with file paths and headings.
```

**`.agents/skills/gl-verify-claim/SKILL.md`:**

```markdown
---
name: gl-verify-claim
description: "Verify whether a claim is supported, contradicted, or not addressed by the giterloper knowledge store. Use for fact-checking or validating statements against stored knowledge."
---

# gl-verify-claim

Evaluate whether a claim is supported, contradicted, or not addressed by the <name> giterloper knowledge store.

## When to use

- When you need to fact-check a statement against the knowledge store
- When you need to validate whether something is documented
- When the user asks whether a claim is accurate according to stored knowledge

## Prerequisites

- The store must be cloned and indexed. If `<giterloper-root>/versions/<name>/<sha>/` does not exist, follow the project README's giterloper section to materialize it.
- QMD must be installed and the collection registered (`qmd collection list` should show `<name>@<sha>`).

## Instructions

1. Extract key concepts from the claim as keywords.
2. Run `qmd search` or `qmd query` broadly; try synonyms in separate searches.
3. Check multiple results for supporting and contradicting evidence.
4. Report supported / contradicted / not addressed with citations.
```

If write operations are enabled, also create the following skills. Write operations use the `staged/` directory and promote to SHA-pinned versions after push (see INSTRUCTIONS.md).

**`.agents/skills/gl-add-knowledge/SKILL.md`:**

```markdown
---
name: gl-add-knowledge
description: "Add new knowledge to the giterloper knowledge store and reconcile it with existing content. Use when the user wants to contribute new information to the store."
---

# gl-add-knowledge

Add new knowledge to the <name> giterloper knowledge store and reconcile it as it is added.

## When to use

- When new information needs to be added to the knowledge store
- When the user wants to contribute content from another source

## Prerequisites

- The store must be cloned and indexed.
- You must have push access to the store's remote.

## Instructions

1. If an asset reference: clone that version if not present, add its QMD collection, fetch content via `qmd search`/`qmd get`.
2. Scan for topical overlap in the existing store: `qmd search "<topic>" -c <name>@<sha> --json`.
3. Create a staged working clone in `<giterloper-root>/staged/<name>/<branch-name>/` on a new branch (see the store's INSTRUCTIONS.md write operations workflow). Never edit the depth=1 read-only clone.
4. Place content in the best-fitting location(s) in the staged clone. Create new topic-named folders if none fit.
5. Consider structure: merge, split, or rename for clarity.
6. Commit, push, promote to SHA-pinned version under `versions/`, update `pinned.yaml` (new SHA at top), and notify the user.
```

**`.agents/skills/gl-subtract-knowledge/SKILL.md`:**

```markdown
---
name: gl-subtract-knowledge
description: "Remove knowledge from the giterloper store that overlaps with specified content. Use when the user wants to prune or deduplicate store content."
---

# gl-subtract-knowledge

Remove from the <name> giterloper knowledge store all knowledge that overlaps with the passed content.

## When to use

- When overlapping or duplicate content needs to be removed
- When the user wants to prune the store against a reference

## Prerequisites

- The store must be cloned and indexed.
- You must have push access to the store's remote.

## Instructions

1. If an asset reference: clone that version if not present, add its QMD collection, fetch content.
2. Extract keywords from the passed knowledge. Find overlapping content: `qmd search "<keywords>" -c <name>@<sha> --json`. Compare semantically.
3. Create a staged working clone and branch.
4. Remove overlapping content in the staged clone. Delete empty files or folders.
5. Commit, push, promote to SHA-pinned version, update `pinned.yaml` (new SHA at top), and notify the user.
```

**`.agents/skills/gl-intersect-knowledge/SKILL.md`:**

```markdown
---
name: gl-intersect-knowledge
description: "Narrow the giterloper knowledge store to only content that overlaps with specified content. Use when the user wants to filter the store to a subset."
---

# gl-intersect-knowledge

Remove from the <name> giterloper knowledge store all knowledge that does *not* overlap with the passed content.

## When to use

- When the store needs to be narrowed to a specific subset
- When the user wants to keep only content relevant to a reference

## Prerequisites

- The store must be cloned and indexed.
- You must have push access to the store's remote.

## Instructions

1. If an asset reference: clone that version if not present, add its QMD collection, fetch content.
2. Extract keywords. Find overlapping and non-overlapping content: `qmd search "<keywords>" -c <name>@<sha> --json`.
3. Create a staged working clone and branch.
4. Remove non-overlapping content in the staged clone. Consolidate folders as needed.
5. Commit, push, promote to SHA-pinned version, update `pinned.yaml` (new SHA at top), and notify the user.
```

---

#### Option C: Cursor-specific skills

Create the same per-operation skill folders as Option B, but place them under `.cursor/skills/` instead of `.agents/skills/`. The `SKILL.md` format is identical — Cursor supports the same frontmatter and structure. The only difference is the directory, which Cursor auto-discovers.

Skill folder layout:

```
.cursor/skills/
├── gl-answer-from-context/
│   └── SKILL.md
├── gl-retrieve-relevant-context/
│   └── SKILL.md
├── gl-verify-claim/
│   └── SKILL.md
└── (write operation skills if enabled)
```

Use the same templates from Option B.

---

#### Adapting to custom instructions

If the user provided custom documentation guidance, implement it faithfully. Use the operation descriptions from `INSTRUCTIONS.md` as source material but restructure, reword, or relocate them as the user directed. Maintain the per-operation, `gl`-namespaced convention unless the user explicitly directs otherwise. When the user's instructions are ambiguous, ask for clarification rather than guessing.
