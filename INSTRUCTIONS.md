# How to use this knowledge store

This repository is a giterloper knowledge store. It contains knowledge about giterloper itself. The knowledge lives under `knowledge/` in topic-named files and folders. There is no fixed taxonomy; folder and file names describe their contents.

This instruction file defines how this knowledge store fulfills the contract defined in `CONSTITUTION.md`

To configure the connection between a target project and this store, see the instructions under `bootstrap/`.

---

## Accessing the knowledge store

### Clone location

Knowledge stores are accessed by cloning with `--depth 1` into a directory chosen by the target project. The default ref is `main`. The default path of a clone is `<giterloper-installation-root>/<path-friendly-repo-identifier>/<version>/`.

### Multi-version layout

Each ref (branch, tag, SHA) gets its own directory. Searching one version never returns results from another.

**When two versions are needed at once** (e.g., add_knowledge from one store into another, or subtract_knowledge / intersect_knowledge comparing versions):

1. Clone the second ref alongside the first.
2. Add its QMD collection: `qmd collection add <path-to-clone>/knowledge --name <store>@<ref> --mask "**/*.md"`.
3. Both collections are independently searchable via `-c <store>@main` and `-c <store>@<ref>`.

### Setup commands

Run these to set up access:

```sh
git clone --depth 1 <repo_url> <path-to-clone>
qmd collection add <path-to-clone>/knowledge --name <store-name>@main --mask "**/*.md"
qmd context add qmd://<store-name>@main "<store description>"
qmd embed
```

### Updating

```sh
git -C <path-to-clone> fetch --depth 1 origin <version>
git -C <path-to-clone> reset --hard origin/<version>
qmd update
```

---

## Searching with QMD

### Search commands

- **`qmd search "<keywords>"`** — Fast keyword search (FTS5/BM25). No models needed.
- **`qmd query "<question>"`** — Hybrid search with query expansion and reranking. Best quality; needs embeddings (~2GB).
- **`qmd vsearch "<query>"`** — Vector semantic search only. Needs embeddings.
- **`qmd get "<path>"`** — Retrieve full document content by path or docid.

### Collection scoping

Scope searches with `-c <store>@<ref>`:

```sh
qmd search "authentication" -c giterloper@main --json -n 10
qmd query "how does chunking work" -c giterloper@main --json
qmd get "background.md" -c giterloper@main --full
```

### Output formats

- `--json` — Structured results for agent processing
- `--full` — Full document content
- `--files` — List matching file paths

---

## Operations

Each operation is defined in [CONSTITUTION.md](CONSTITUTION.md). Below: how to perform them for this store.

### Read operations

Read operations work against the existing depth=1 clone. Do not modify the clone.

#### answer_from_context

1. Resolve scope: if an asset reference is given, clone that version if needed; otherwise use this store at the default ref.
2. Extract keywords from the question. Run `qmd search "<keywords>" -c <store>@<ref> --json -n 10` or `qmd query "<question>" -c <store>@<ref> --json`. Use returned chunks. If a result suggests more detail, run `qmd get "<path>" --full`.
3. Compose an answer from that content only. Cite file paths and headings.

#### retrieve_relevant_context

1. Run `qmd search` or `qmd query` for 5–10 results. Run multiple searches if the query spans topics.
2. Use `qmd get "<path>" --full` when broader context is needed.
3. Return a concise summary and/or key excerpts, with file paths and headings.

#### verify_claim

1. Extract key concepts as keywords.
2. Run `qmd search` or `qmd query` broadly; try synonyms in separate searches.
3. Check **multiple** results. Look for supporting and contradicting evidence.
4. Report supported / contradicted / not addressed with citations.

### Write operations

Write operations mutate knowledge. **Never modify the existing depth=1 clone in place.** The checked-out copy is read-only for operational purposes. Instead:

1. **Create a working clone.** Clone the repo at full depth (or sufficient depth) into a new directory alongside the existing clone, on a new branch named for the change or task (e.g. `add/topic-name`, `subtract/overlap-cleanup`):

   ```sh
   git clone <repo_url> <giterloper-root>/<store>/<branch-name>/
   git -C <giterloper-root>/<store>/<branch-name>/ checkout -b <branch-name>
   ```

2. **Make changes** in the working clone (see per-operation steps below).
3. **Commit and push** the working clone to the remote:

   ```sh
   git -C <working-clone> add -A
   git -C <working-clone> commit -m "<descriptive message>"
   git -C <working-clone> push -u origin <branch-name>
   ```

4. **Update QMD.** Add a QMD collection for the new branch if needed, then run `qmd update`.
5. **Notify the user.** Tell them a new branch `<branch-name>` was created and pushed. Offer to merge it into whichever branch they were working from (e.g. `main`), or let them review and merge at their discretion.

#### add_knowledge

1. If an asset reference: clone that version if not present, add its QMD collection, fetch content via `qmd search`/`qmd get`.
2. In the existing read-only clone, scan for topical overlap: `qmd search "<topic>" -c <store>@<ref> --json`.
3. Create a working clone and branch (see write operation steps above).
4. Place content in the best-fitting folder(s) in the working clone. Create a new topic-named folder if none fit.
5. Consider structure: merge, split, or rename for clarity.
6. Commit, push, update QMD, and notify the user.

#### subtract_knowledge

1. If an asset reference: clone that version if not present, add its QMD collection, fetch content.
2. Extract keywords from the passed knowledge. Find overlapping content: `qmd search "<keywords>" -c <store>@<ref> --json`. Compare semantically.
3. Create a working clone and branch.
4. Remove overlapping content in the working clone. Delete empty files or folders.
5. Commit, push, update QMD, and notify the user.

#### intersect_knowledge

1. If an asset reference: clone that version if not present, add its QMD collection, fetch content.
2. Extract keywords. Find overlapping content: `qmd search "<keywords>" -c <store>@<ref> --json`. Identify what overlaps and what does not.
3. Create a working clone and branch.
4. Remove non-overlapping content in the working clone. Consolidate folders as needed.
5. Commit, push, update QMD, and notify the user.
