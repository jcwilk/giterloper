# How to use this knowledge store

This repository is a giterloper knowledge store. It contains knowledge about giterloper itself. The file `giterloper.yaml` at the root describes the store's name, topic, and scope. The knowledge lives under `knowledge/` in folders whose names are semantic (e.g. `background/`, `problems_this_solves/`, `how_it_works/`). There is no fixed taxonomy; folder names describe their contents.

You must support six operations. All accept inputs as raw string or asset reference, so you can combine different stores. Content is accessed via a depth=1 clone; QMD indexes the knowledge directory for search.

---

## Accessing the knowledge store

### Clone location

Knowledge stores are accessed by cloning with `--depth 1` into `.giterloper/repos/<ref>/`. The default ref is `main`.

```
.giterloper/
  repos/
    main/                          # git clone --depth 1 --branch main <repo_url>
      knowledge/
      giterloper.yaml
      INSTRUCTIONS.md
      ...
```

### Multi-version layout

Each ref (branch, tag, SHA) gets its own directory. This keeps versions isolated—searching one version never returns results from another.

- `giterloper@main` — default branch
- `giterloper@v1.0.0` — tagged release

**When two versions are needed at once** (e.g., `add_knowledge` from one store version into another, or `subtract_knowledge` / `intersect_knowledge` comparing two versions):

1. Clone the second ref: `git clone --depth 1 --branch <ref> <url> .giterloper/repos/<ref>/`
2. Add its QMD collection: `qmd collection add .giterloper/repos/<ref>/knowledge --name <store>@<ref> --mask "**/*.md"`
3. Both collections are now independently searchable via `-c <store>@main` and `-c <store>@<ref>`

### Setup commands

Run these to set up access (do not auto-run; present to the user):

```sh
# 1. Clone the store (default branch)
git clone --depth 1 <repo_url> .giterloper/repos/main/

# 2. Create QMD collection for the knowledge directory
qmd collection add .giterloper/repos/main/knowledge --name <store-name>@main --mask "**/*.md"

# 3. Add context from giterloper.yaml description
qmd context add qmd://<store-name>@main "<store description>"

# 4. (Optional) Generate embeddings for semantic search
qmd embed
```

### Updating

```sh
git -C .giterloper/repos/main/ fetch --depth 1 origin main
git -C .giterloper/repos/main/ reset --hard origin/main
qmd update
```

Or: `qmd update --pull` (QMD does the git pull in the collection directory).

---

## Searching with QMD

### Search commands

- **`qmd search "<keywords>"`** — Fast keyword search (FTS5/BM25). No models needed.
- **`qmd query "<question>"`** — Hybrid search with query expansion and reranking. Best quality; needs embeddings (~2GB).
- **`qmd vsearch "<query>"`** — Vector semantic search only. Needs embeddings.
- **`qmd get "<path>"`** — Retrieve full document content by path or docid.

### Collection scoping

Scope searches to a specific version with `-c <store>@<ref>`:

```sh
qmd search "authentication" -c giterloper@main --json -n 10
qmd query "how does chunking work" -c giterloper@main --json
qmd get "background/README.md" -c giterloper@main --full
```

### Output formats

- `--json` — Structured results for agent processing
- `--full` — Full document content
- `--files` — List matching file paths

### When QMD is not set up

Read files directly from `.giterloper/repos/<ref>/knowledge/`. Use semantic folder names to navigate (e.g. `background/`, `problems_this_solves/`).

---

## Operations

### answer_from_context

Answer the user's question using **only** information from the scoped context. Accepts the question as a raw string; scope may be an asset reference (default: this store). Do not add outside knowledge or assumptions. Ground every claim in the retrieved content.

1. Resolve scope: if an asset reference is given, clone that version if needed; otherwise use this store at the default ref.
2. Read `giterloper.yaml` to understand scope.
3. **Find relevant content:**
   - **If QMD collection exists:** Extract keywords from the question. Run `qmd search "<keywords>" -c <store>@<ref> --json -n 10` or `qmd query "<question>" -c <store>@<ref> --json`. Use returned chunks. If a result suggests more detail is in a file, run `qmd get "<path>" --full`.
   - **If QMD not set up:** Read files from `.giterloper/repos/<ref>/knowledge/`, picking folders by name relevance.
4. Compose an answer from that content only. Cite file paths and headings.

### retrieve_relevant_context

Retrieve and summarize the most relevant parts of the scoped context for a given query. Accepts the query as a raw string; scope may be an asset reference (default: this store).

1. Resolve scope; read `giterloper.yaml` for store metadata.
2. **Find relevant content:**
   - **If QMD exists:** `qmd search "<keywords>" -c <store>@<ref> --json -n 10` or `qmd query "<query>" -c <store>@<ref> --json`. Collect 5–10 results. If the query spans topics, run multiple searches with different keyword sets.
   - **If no QMD:** Read files from relevant folders under `.giterloper/repos/<ref>/knowledge/`.
3. If a result needs broader context, run `qmd get "<path>" --full`.
4. Return a concise summary and/or key excerpts, with file paths and headings.

### verify_claim

Say whether a claim is **supported**, **contradicted**, or **not addressed** by the scoped context. Accepts the claim as a raw string; scope may be an asset reference (default: this store).

1. Extract key concepts from the claim as keywords.
2. **Find relevant content:**
   - **If QMD exists:** `qmd search "<keywords>" -c <store>@<ref> --json -n 20` or `qmd query "<claim>" -c <store>@<ref> --json`. Cast a wide net; try synonyms or related terms in separate searches.
   - **If no QMD:** Read files from folders that might relate to the claim.
3. Check **multiple** results, not just the first. Look for both supporting and contradicting evidence.
4. If the content clearly supports or contradicts the claim, say so and cite file path and heading. If nothing addresses it, report "not addressed".

### add_knowledge

Add new knowledge and reconcile it with the existing store. Accepts the knowledge as a raw string or an asset reference (e.g. to another store or version).

1. If an asset reference: clone that version into `.giterloper/repos/<ref>/` if not present, add its QMD collection, then fetch content via search/get.
2. Scan existing `knowledge/` folder names for topical overlap. If QMD exists: `qmd search "<topic>" -c <store>@main --json` to see whether similar knowledge already exists and where.
3. Place content in the best-fitting folder(s). If none fit, create a new folder with an underscore-separated name (e.g. `new_topic_area`).
4. Consider whether the structure should change: merge folders, split one, or rename for clarity.
5. **Update QMD:** Run `qmd update` to re-index the modified clone.
6. Commit with a clear message. Requires write access (local clone with push, or PR via API).

### subtract_knowledge

Remove from this store all knowledge that overlaps with the passed knowledge. Accepts the knowledge as a raw string or an asset reference.

1. If an asset reference: clone that version if needed, add its QMD collection, fetch content.
2. Extract keywords from the passed knowledge.
3. **Find overlapping content:**
   - **If QMD exists:** `qmd search "<keywords>" -c <store>@<ref> --json -n 50`. Read matched results and compare semantically with the passed knowledge.
   - **If no QMD:** Read files from relevant folders and compare.
4. Remove overlapping content. If a file or folder becomes empty, delete it.
5. **Update QMD:** Run `qmd update`.
6. Commit with a clear message.

### intersect_knowledge

Remove from this store all knowledge that does **not** overlap with the passed knowledge. Accepts the knowledge as a raw string or an asset reference.

1. If an asset reference: clone that version if needed, add its QMD collection, fetch content.
2. Extract keywords from the passed knowledge.
3. **Find overlapping content:**
   - **If QMD exists:** `qmd search "<keywords>" -c <store>@<ref> --json --all` to find chunks that match. Everything not in the results is a candidate for removal. Confirm by semantic comparison.
   - **If no QMD:** Read all files, compare each with the passed knowledge, keep only what overlaps.
4. Remove non-overlapping content. Merge or consolidate folders as needed.
5. **Update QMD:** Run `qmd update`.
6. Commit with a clear message.

---

## This repository specifically

- **Config:** `giterloper.yaml` at root (`name`, `topic`, `description`, `repo_url`, `constitution_version`).
- **Knowledge root:** `knowledge/`. Subfolders are self-identifying (e.g. `background/`, `problems_this_solves/`, `how_it_works/`, `retrieval_and_search/`). No fixed schema; add or rename folders as the store evolves.
- **Constitution:** A verbatim copy lives in `.giterloper/constitution.md`. Do not edit it; verify with root `CONSTITUTION.md5` if needed.
