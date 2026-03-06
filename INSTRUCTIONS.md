# How to use this knowledge store

This repository is a giterloper knowledge store. It contains knowledge about giterloper itself. The knowledge lives under `knowledge/` in topic-named files and folders. There is no fixed taxonomy; folder and file names describe their contents.

This instruction file defines how this knowledge store fulfills the contract defined in `CONSTITUTION.md`

To configure the connection between a target project and this store, see the instructions under `bootstrap/`.

---

## Accessing the knowledge store

### Installation layout

In the target project, giterloper state lives under a single root directory (default `.giterloper/`). This directory contains:

- **`pinned.yaml`** — committed to the target project. Maps human-friendly names to store references using the asset reference scheme (`source@sha`). Pins **must** use full commit SHAs — never branch names or tags. The first entry is the default store for operations. Example:

  ```yaml
  giterloper: github.com/jcwilk/giterloper@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
  ```

- **`versions/`** — gitignored. Contains read-only depth=1 clones, laid out as `versions/<name>/<sha>/`. The `<name>` corresponds to a key in `pinned.yaml`; the `<sha>` is the exact commit SHA checked out. These clones are never modified in place.

- **`staged/`** — gitignored. Contains depth=1 working clones used by write operations, laid out as `staged/<name>/<branch-name>/`. Staged clones are temporary — after a successful push they are deleted and replaced with a SHA-pinned read-only version under `versions/`.

This separation means the target project commits only a lightweight manifest (`pinned.yaml`) while the potentially large cloned content stays out of version control.

### Clone location

Knowledge stores are accessed by cloning with `--depth 1` into `<giterloper-root>/versions/<name>/<sha>/`. The `<name>` and `<sha>` come from `pinned.yaml`.

### SHA resolution

Pins must always use full commit SHAs. When connecting to a store at a human-readable ref (branch or tag), resolve the SHA first:

```sh
git ls-remote https://<source> <human-ref> | cut -f1
```

Use the resulting SHA for `pinned.yaml`, the clone directory name, and QMD collection names.

### Multi-version layout

Each SHA gets its own directory under its store name. Searching one version never returns results from another.

**When two versions are needed at once** (e.g., add_knowledge from one store into another, or subtract_knowledge / intersect_knowledge comparing versions):

1. Resolve the second ref to a SHA. Clone it alongside the first under `versions/<name>/<sha2>`.
2. Add its QMD collection: `qmd collection add <path-to-clone>/knowledge --name <name>@<sha2> --mask "**/*.md"`.
3. Both collections are independently searchable via `-c <name>@<sha1>` and `-c <name>@<sha2>`.

### Setup commands

Run these to set up access. All QMD commands here are idempotent — re-running them on an already-configured store is safe.

```sh
# Resolve the SHA (if starting from a branch/tag)
SHA=$(git ls-remote https://<source> <human-ref> | cut -f1)

# Clone at that exact SHA
git clone --depth 1 https://<source> .giterloper/versions/<name>/$SHA
git -C .giterloper/versions/<name>/$SHA checkout $SHA

# Index with QMD
qmd collection add .giterloper/versions/<name>/$SHA/knowledge --name <name>@$SHA --mask "**/*.md"
qmd context add qmd://<name>@$SHA "<store description>"
qmd embed

# Write the pin (SHA must be the full 40-char hash)
# pinned.yaml entry: <name>: <source>@$SHA
```

### Updating

To update a pinned store to a newer commit on a given branch or tag:

```sh
# Resolve the new SHA
NEW_SHA=$(git ls-remote https://<source> <human-ref> | cut -f1)

# Clone the new version
git clone --depth 1 https://<source> .giterloper/versions/<name>/$NEW_SHA
git -C .giterloper/versions/<name>/$NEW_SHA checkout $NEW_SHA

# Index the new version
qmd collection add .giterloper/versions/<name>/$NEW_SHA/knowledge --name <name>@$NEW_SHA --mask "**/*.md"
qmd context add qmd://<name>@$NEW_SHA "<store description>"
qmd embed

# Tear down the old version
qmd context rm qmd://<name>@$OLD_SHA
qmd collection remove <name>@$OLD_SHA
rm -rf .giterloper/versions/<name>/$OLD_SHA

# Update pinned.yaml: change the SHA, keep the entry at the top
```

### Teardown

When discarding a cloned version, clean up both the QMD index and the clone directory:

```sh
qmd context rm qmd://<name>@<sha>
qmd collection remove <name>@<sha>
rm -rf .giterloper/versions/<name>/<sha>
```

If removing the last SHA for a given `<name>`, also remove the now-empty parent directory:

```sh
rmdir .giterloper/versions/<name>
```

To clean up a staged working clone (e.g. after a failed or abandoned write operation):

```sh
rm -rf .giterloper/staged/<name>/<branch-name>
```

---

## Searching with QMD

### Search commands

- **`qmd search "<keywords>"`** — Fast keyword search (FTS5/BM25). No models needed.
- **`qmd query "<question>"`** — Hybrid search with query expansion and reranking. Best quality; needs embeddings (~2GB).
- **`qmd vsearch "<query>"`** — Vector semantic search only. Needs embeddings.
- **`qmd get "<path>"`** — Retrieve full document content by path or docid.

### Collection scoping

Scope searches with `-c <name>@<sha>`:

```sh
qmd search "authentication" -c giterloper@a1b2c3d4... --json -n 10
qmd query "how does chunking work" -c giterloper@a1b2c3d4... --json
qmd get "background.md" -c giterloper@a1b2c3d4... --full
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

1. Resolve scope: if an asset reference is given, resolve its SHA and clone that version if needed; otherwise use this store at the pinned SHA.
2. Extract keywords from the question. Run `qmd search "<keywords>" -c <name>@<sha> --json -n 10` or `qmd query "<question>" -c <name>@<sha> --json`. Use returned chunks. If a result suggests more detail, run `qmd get "<path>" --full`.
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

Write operations mutate knowledge. **Never modify the existing depth=1 clone in place.** The read-only clone under `versions/` is immutable. Instead, write operations use the `staged/` directory for working clones and promote the result to a new SHA-pinned version after a successful push.

#### Write operation workflow

1. **Create a staged working clone.** Clone the repo with `--depth 1` into `staged/<name>/<branch-name>/` on a new branch named for the change or task (e.g. `add/topic-name`, `subtract/overlap-cleanup`):

   ```sh
   git clone --depth 1 https://<source> .giterloper/staged/<name>/<branch-name>/
   git -C .giterloper/staged/<name>/<branch-name>/ checkout -b <branch-name>
   ```

2. **Make changes** in the staged clone (see per-operation steps below).

3. **Commit and push** the staged clone to the remote:

   ```sh
   git -C .giterloper/staged/<name>/<branch-name>/ add -A
   git -C .giterloper/staged/<name>/<branch-name>/ commit -m "<descriptive message>"
   git -C .giterloper/staged/<name>/<branch-name>/ push -u origin <branch-name>
   ```

4. **Promote to a SHA-pinned version.** After a successful push:

   ```sh
   # Resolve the new commit SHA
   NEW_SHA=$(git -C .giterloper/staged/<name>/<branch-name>/ rev-parse HEAD)

   # Clone the new SHA as a read-only version
   git clone --depth 1 https://<source> .giterloper/versions/<name>/$NEW_SHA
   git -C .giterloper/versions/<name>/$NEW_SHA checkout $NEW_SHA

   # Index the new version with QMD
   qmd collection add .giterloper/versions/<name>/$NEW_SHA/knowledge --name <name>@$NEW_SHA --mask "**/*.md"
   qmd context add qmd://<name>@$NEW_SHA "<store description>"
   qmd embed

   # Tear down the old pinned version
   qmd context rm qmd://<name>@$OLD_SHA
   qmd collection remove <name>@$OLD_SHA
   rm -rf .giterloper/versions/<name>/$OLD_SHA

   # Delete the staged clone
   rm -rf .giterloper/staged/<name>/<branch-name>
   rmdir .giterloper/staged/<name> 2>/dev/null  # clean up if empty
   ```

5. **Update `pinned.yaml`.** Replace the store's entry with the new SHA and **move it to the top** of the file so the most recently written version is the first pinned item (which operations target by default):

   ```yaml
   # Updated entry moves to top
   <name>: <source>@$NEW_SHA
   # ... other entries below ...
   ```

6. **Notify the user.** Tell them a new branch `<branch-name>` was created and pushed at SHA `$NEW_SHA`. The pin has been updated and the new knowledge is immediately available for read operations. Offer to merge the branch into whichever branch they were working from (e.g. `main`), or let them review and merge at their discretion.

#### add_knowledge

1. If an asset reference: clone that version if not present, add its QMD collection, fetch content via `qmd search`/`qmd get`.
2. In the existing read-only clone, scan for topical overlap: `qmd search "<topic>" -c <name>@<sha> --json`.
3. Create a staged working clone and branch (see write operation workflow above).
4. Place content in the best-fitting folder(s) in the staged clone. Create a new topic-named folder if none fit.
5. Consider structure: merge, split, or rename for clarity.
6. Commit, push, promote to SHA-pinned version, update `pinned.yaml`, and notify the user.

#### subtract_knowledge

1. If an asset reference: clone that version if not present, add its QMD collection, fetch content.
2. Extract keywords from the passed knowledge. Find overlapping content: `qmd search "<keywords>" -c <name>@<sha> --json`. Compare semantically.
3. Create a staged working clone and branch.
4. Remove overlapping content in the staged clone. Delete empty files or folders.
5. Commit, push, promote to SHA-pinned version, update `pinned.yaml`, and notify the user.

#### intersect_knowledge

1. If an asset reference: clone that version if not present, add its QMD collection, fetch content.
2. Extract keywords. Find overlapping content: `qmd search "<keywords>" -c <name>@<sha> --json`. Identify what overlaps and what does not.
3. Create a staged working clone and branch.
4. Remove non-overlapping content in the staged clone. Consolidate folders as needed.
5. Commit, push, promote to SHA-pinned version, update `pinned.yaml`, and notify the user.
