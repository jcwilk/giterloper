# How to use this knowledge store

This repository is a giterloper knowledge store. It contains knowledge about giterloper itself. The file `giterloper.yaml` at the root describes the store's name, topic, and scope. The knowledge lives under `knowledge/` in folders whose names are semantic (e.g. `background/`, `problems_this_solves/`, `how_it_works/`). There is no fixed taxonomy; folder names describe their contents.

You must support six operations. All accept inputs as raw string or asset reference, so you can combine different stores. How you retrieve content depends on where you run and whether a cache exists. Prefer the GitHub API; use a shallow clone only when you need bulk access; use a local index when present.

---

## Retrieval strategy (tiered)

### Check first: local index

If `.giterloper/cache/index.db` exists, use it first. Query it for keywords or file summaries to find relevant paths, then read only those files. This avoids API calls and is the fastest path.

### Primary: GitHub API

This store is hosted on GitHub. Prefer the REST API so you do not pull repo history (knowledge stores can have long histories of edits).

**Rate limits:**

- **Unauthenticated:** ~60 requests per hour per IP. Plan carefully: e.g. one tree call plus a few file reads per session.
- **Authenticated:** ~5,000 requests per hour. If the user has configured a token (e.g. in `.giterloper/auth` or `GITHUB_TOKEN`), use it. If not, during setup you may ask whether to store a token in `.giterloper/auth` (gitignored); if they decline, use unauthenticated access and cache aggressively.

**Procedure:**

1. Get the default branch or the ref you need (e.g. `GET /repos/{owner}/{repo}` for `default_branch`, or use `main`).
2. Get the tree: `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`. One call gives the full directory structure.
3. Use folder names under `knowledge/` to decide which paths are relevant (folder names are semantic).
4. Fetch only the files you need via `GET /repos/{owner}/{repo}/contents/{path}` (or the Git blobs API if you prefer).
5. Write any fetched content into `.giterloper/cache/` (e.g. by path) so later operations can read from cache instead of calling the API again. `.giterloper/cache/` is gitignored.

If you get 403 with rate-limit headers, stop until the reset time or switch to the shallow-clone fallback.

### Fallback: shallow git clone

If you have `git` available and need more than the API budget allows (e.g. bulk indexing, or many files in one session):

1. Clone into a **cache directory**, not the working tree: `git clone --depth 1 <repo_url> .giterloper/cache/repo/`. `.giterloper/cache/` is gitignored.
2. All further reads are local; no API cost.
3. To refresh later: `git -C .giterloper/cache/repo fetch --depth 1 origin main` (or the default branch), then checkout as needed.

Use `--depth 1` to avoid pulling long history. Knowledge stores often have many small commits.

### Git submodules (optional, not default)

Users can add this store as a submodule to pin a folder to a specific commit. Submodules are not recommended by default: `git submodule update` fetches history, and shallow submodules are not well supported everywhere. Mention submodules as an option for users who want tight coupling; do not recommend them as the primary access method.

---

## Operations

### answer_from_context

Answer the user's question using **only** information from the scoped context. Accepts the question as a raw string; scope may be an asset reference (default: this store). Do not add outside knowledge or assumptions. Ground every claim in the retrieved content.

1. Resolve scope: if an asset reference is given, fetch that content; otherwise use this store.
2. Read `giterloper.yaml` to understand scope.
3. **Find relevant content:**
   - **If `.giterloper/cache/index.db` exists:** Extract keywords from the question. Query the index:
     ```sql
     SELECT file_path, heading, summary, content FROM chunks
     WHERE keywords LIKE '%' || :term || '%' OR summary LIKE '%' || :term || '%'
     ORDER BY <match count> DESC;
     ```
     Read the returned chunks. If they are sufficient, use them directly. If a chunk's summary suggests the full file has more detail, read that file.
   - **If no index:** Use the tree API (or local clone) to list `knowledge/` folders. Pick folders by name relevance, read their files.
4. Read only the files in relevant folders. Stay within API budget (prefer cached content or index results).
5. Compose an answer from that content only. Cite file paths and chunk headings.

### retrieve_relevant_context

Retrieve and summarize the most relevant parts of the scoped context for a given query. Accepts the query as a raw string; scope may be an asset reference (default: this store).

1. Resolve scope as above; read `giterloper.yaml` for store metadata.
2. **Find relevant content:**
   - **If index exists:** Extract keywords from the query. Query:
     ```sql
     SELECT file_path, heading, summary, content FROM chunks
     WHERE keywords LIKE '%' || :term || '%' OR summary LIKE '%' || :term || '%';
     ```
     Collect the top results (aim for 5-10 chunks that cover the query). If the query spans topics, use multiple keyword sets.
   - **If no index:** List `knowledge/` folders via tree API or clone. Read files from the most relevant folders.
3. If a chunk summary indicates broader context is needed, read the full file (1-2 file reads max when unauthenticated).
4. Return a concise summary and/or key excerpts, with file paths and chunk headings.

### verify_claim

Say whether a claim is **supported**, **contradicted**, or **not addressed** by the scoped context. Accepts the claim as a raw string; scope may be an asset reference (default: this store).

1. Extract the key concepts from the claim as keywords.
2. **Find relevant content:**
   - **If index exists:** Query for chunks matching the claim's keywords. Cast a wide net — use both `keywords` and `summary` columns, and try synonyms or related terms:
     ```sql
     SELECT file_path, heading, content FROM chunks
     WHERE keywords LIKE '%' || :term || '%' OR content LIKE '%' || :term || '%';
     ```
   - **If no index:** Scan `knowledge/` folders by name; read files from any folder that might relate to the claim.
3. Check **multiple** returned chunks, not just the first match. Look for both supporting and contradicting evidence.
4. If the content clearly supports or contradicts the claim, say so and cite the file path and chunk heading. If nothing in the store addresses it, report "not addressed".

### add_knowledge

Add new knowledge and reconcile it with the existing store. Accepts the knowledge as a raw string or an asset reference (e.g. to another store).

1. If an asset reference: fetch the content from that store/path first.
2. Scan existing `knowledge/` folder names for topical overlap. If the index exists, also query it:
   ```sql
   SELECT DISTINCT file_path, heading, summary FROM chunks
   WHERE keywords LIKE '%' || :topic_term || '%';
   ```
   This reveals whether similar knowledge already exists and where.
3. Place content in the best-fitting folder(s). If none fit, create a new folder with an underscore-separated name (e.g. `new_topic_area`).
4. Consider whether the structure should change: merge folders, split one, or rename for clarity. Do so if it improves coherence.
5. **Update the index** if `.giterloper/cache/index.db` exists:
   - For each new or modified file, compute its SHA-256 hash.
   - Delete old `chunks` and `files` rows for that path.
   - Re-chunk the file per the chunking strategy, generate summaries and keywords, insert new rows.
   - This is the incremental update path; no need to rebuild the full index.
6. Commit with a clear message. Requires write access (local clone with push, or PR via API).

### subtract_knowledge

Remove from this store all knowledge that overlaps with the passed knowledge. Accepts the knowledge as a raw string or an asset reference.

1. If an asset reference: fetch the content from that store/path.
2. Extract keywords and key concepts from the passed knowledge.
3. **Find overlapping content:**
   - **If index exists:** Query for chunks that overlap with the passed knowledge:
     ```sql
     SELECT file_path, heading, content, chunk_order FROM chunks
     WHERE keywords LIKE '%' || :term || '%' OR summary LIKE '%' || :term || '%';
     ```
     Read the matched chunks and compare semantically with the passed knowledge to confirm true overlap.
   - **If no index:** Read files from relevant `knowledge/` folders and compare.
4. Remove overlapping content. If removing chunks leaves a file empty or a folder empty, delete the file/folder.
5. **Update the index:** Delete `chunks` rows for removed content. Delete `files` rows for deleted files. For files that were partially modified (some chunks removed), reindex the file: delete all its rows, re-chunk the modified file, and reinsert.
6. Commit with a clear message.

### intersect_knowledge

Remove from this store all knowledge that does **not** overlap with the passed knowledge. Accepts the knowledge as a raw string or an asset reference.

1. If an asset reference: fetch the content from that store/path.
2. Extract keywords and key concepts from the passed knowledge.
3. **Find overlapping content:**
   - **If index exists:** Query the index (same approach as `subtract_knowledge`) to find chunks that match the passed knowledge. Also query for all chunks to identify those that do NOT overlap.
     ```sql
     -- Find chunks that DO overlap (keep these)
     SELECT id, file_path, chunk_order FROM chunks
     WHERE keywords LIKE '%' || :term || '%' OR summary LIKE '%' || :term || '%';
     ```
     Everything not in this result set is a candidate for removal. Confirm by semantic comparison.
   - **If no index:** Read all files, compare each with the passed knowledge, keep only what overlaps.
4. Remove non-overlapping content. Merge or consolidate folders as needed.
5. **Update the index:** Delete rows for removed files and chunks. For partially modified files, reindex them (delete all rows, re-chunk, reinsert). Run the prune step to remove `files` rows for deleted paths.
6. Commit with a clear message.

---

## Index and cache

- **Location:** `.giterloper/cache/` (gitignored). Typical contents: `index.db` (SQLite), `repo/` for a shallow clone, and any API-fetched file dumps.

### Prerequisites

Building and querying the index requires SQLite. Check for availability in this order:

1. **Python `sqlite3` module** (preferred — available in nearly all Python installations): `python3 -c "import sqlite3; print(sqlite3.sqlite_version)"`. Use Python to run the build and query steps below.
2. **`sqlite3` CLI**: `sqlite3 --version`. Use shell commands or pipe SQL directly.
3. **If neither is available:** Check for `python`, `python3.x` variants, or install SQLite via the system package manager (`apt install sqlite3`, `brew install sqlite3`, `apk add sqlite`, etc.). As a last resort, fall back to tree-based retrieval without an index.

The bootstrap installation step "Ensure prerequisites" covers detection and installation. See INSTRUCTIONS.md section "Building the index" for the actual build procedure.

### SQLite schema

The index lives at `.giterloper/cache/index.db`. Create it with:

```sql
CREATE TABLE IF NOT EXISTS files (
    path        TEXT PRIMARY KEY,   -- relative to repo root, e.g. knowledge/background/README.md
    content_hash TEXT,              -- SHA-256 of file content; used to detect changes
    indexed_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chunks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path   TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
    heading     TEXT,               -- heading text that introduces this chunk (NULL for preamble)
    content     TEXT NOT NULL,      -- the full text of this atomic chunk
    summary     TEXT,               -- 1-2 sentence summary of what this chunk says
    keywords    TEXT,               -- comma-separated lowercase keywords
    chunk_order INTEGER NOT NULL,   -- position within the file (0-based)
    UNIQUE(file_path, chunk_order)
);

CREATE INDEX IF NOT EXISTS idx_chunks_keywords ON chunks(keywords);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_path);
```

### Chunking strategy

Each knowledge file is split into **atomic chunks** — self-contained units of knowledge that can be retrieved and understood independently. The chunking rules:

1. **Split on headings.** Every markdown heading (`#`, `##`, `###`, etc.) starts a new chunk. The chunk includes the heading line and all content until the next heading of equal or higher level (fewer `#` characters), or end of file.
2. **Preamble chunk.** Content before the first heading in a file becomes chunk 0 with `heading = NULL`.
3. **Minimum size.** If a chunk is fewer than ~20 words (e.g. a heading with only a one-line sentence), merge it into the next chunk at the same or lower level rather than storing it alone.
4. **Maximum size.** If a chunk exceeds ~500 words, split it at paragraph boundaries (blank lines) into sub-chunks. Each sub-chunk inherits the parent heading plus a suffix like "(part 2)".
5. **Bullet-list items under a heading** stay together as one chunk; do not split individual bullets into separate chunks.
6. **Non-markdown files.** For non-markdown files (YAML, plain text, etc.), treat the entire file as one chunk unless it has clear section delimiters.

### Building the index

Run these steps whenever the index is missing, stale, or after `add_knowledge` / `subtract_knowledge` / `intersect_knowledge` modifies files.

**Step 1 — Obtain knowledge content locally.** Use whichever retrieval tier is available:
- If `.giterloper/cache/repo/` exists (shallow clone), use it directly.
- Otherwise, clone: `git clone --depth 1 <repo_url> .giterloper/cache/repo/`
- Or fetch files via the GitHub API and write them to `.giterloper/cache/`.

**Step 2 — Create (or open) the database.** Connect to `.giterloper/cache/index.db` and run the schema SQL above (the `IF NOT EXISTS` clauses make this idempotent).

**Step 3 — Walk knowledge files.** List all files under `knowledge/` (and `giterloper.yaml`, `INSTRUCTIONS.md`, and `CONSTITUTION.md` at root). For each file:

1. Compute the SHA-256 hash of the file content.
2. Check the `files` table: if a row exists with the same `path` and `content_hash`, skip (already indexed).
3. Otherwise, delete any existing rows for that path (from both `files` and `chunks`), then:
   a. Insert a new `files` row with `path` and `content_hash`.
   b. Parse the file into chunks per the chunking strategy above.
   c. For each chunk, generate a `summary` (1-2 sentences describing what the chunk says) and `keywords` (5-15 lowercase comma-separated terms covering the main concepts).
   d. Insert a `chunks` row for each chunk.

**Step 4 — Prune deleted files.** Query `files` for paths that no longer exist in the knowledge store. Delete those rows (cascading to `chunks`).

### Querying the index

To find relevant chunks for a query string:

```sql
-- Keyword search: match any query term against the keywords column
SELECT c.file_path, c.heading, c.summary, c.content, f.content_hash
FROM chunks c
JOIN files f ON c.file_path = f.path
WHERE c.keywords LIKE '%' || :term1 || '%'
   OR c.keywords LIKE '%' || :term2 || '%'
   OR c.summary LIKE '%' || :term1 || '%'
   OR c.summary LIKE '%' || :term2 || '%'
ORDER BY
  -- Prefer chunks matching more terms
  (CASE WHEN c.keywords LIKE '%' || :term1 || '%' THEN 1 ELSE 0 END +
   CASE WHEN c.keywords LIKE '%' || :term2 || '%' THEN 1 ELSE 0 END) DESC,
  c.file_path, c.chunk_order;
```

Extract query terms by lowercasing the query, removing stop words, and splitting on whitespace/punctuation. Use as many `:termN` parameters as there are meaningful terms.

If the index returns relevant `file_path` values but the chunk content is insufficient, read the full file for deeper context — this is the "index lookup plus 1-2 file reads" pattern that keeps API usage low.

### Rebuilding the index

Rebuild when:
- `.giterloper/cache/index.db` does not exist.
- The knowledge store has been updated (new commits, `add_knowledge`, etc.).
- A query returns no results for a topic you know exists in the store.

To rebuild fully: delete `.giterloper/cache/index.db` and rerun the build steps. To do an incremental update: run the build steps as-is (the content hash check skips unchanged files).

---

## This repository specifically

- **Config:** `giterloper.yaml` at root (`name`, `topic`, `description`, `repo_url`, `constitution_version`).
- **Knowledge root:** `knowledge/`. Subfolders are self-identifying (e.g. `background/`, `problems_this_solves/`, `how_it_works/`). No fixed schema; add or rename folders as the store evolves.
- **Constitution:** A verbatim copy lives in `.giterloper/constitution.md`. Do not edit it; verify with root `CONSTITUTION.md5` if needed.
