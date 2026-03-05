## Infrastructure

### Index database

The project maintains a SQLite index in `.giterloper/cache/index.db` for fast retrieval without repeated API calls. The index stores **atomic chunks** of knowledge — each chunk is a self-contained section of a knowledge file, split at heading boundaries, with extracted keywords and a short summary.

**What the index contains:**

| Table | Columns | Purpose |
|-------|---------|---------|
| `files` | `path`, `content_hash`, `indexed_at` | Tracks which files are indexed and detects changes via SHA-256 hash |
| `chunks` | `id`, `file_path`, `heading`, `content`, `summary`, `keywords`, `chunk_order` | Atomic knowledge units with searchable keywords and summaries |

**How it works in practice:**

1. When an operation needs to find relevant knowledge, it extracts keywords from the query and runs `SELECT ... FROM chunks WHERE keywords LIKE '%term%'` against the index.
2. Matched chunks provide both a summary (for quick relevance assessment) and full content (to avoid an extra file read).
3. If a chunk's content is insufficient, the agent reads the full source file — but this is the exception, not the rule. Most queries are satisfied by index results alone.

**Full details** (schema DDL, chunking rules, build steps, query patterns) are in the store's INSTRUCTIONS.md under "Index and cache". When generating the project's INSTRUCTIONS.md (step 7), copy or adapt those details so the project has a self-contained reference.

**Building the index** is covered in installation step 8 and in INSTRUCTIONS.md's "Building the index" section. The key points:
- Chunk markdown files at heading boundaries into atomic units (~20-500 words each).
- Generate keywords (5-15 terms) and a 1-2 sentence summary for each chunk.
- Use content hashes to skip unchanged files on incremental rebuilds.
- Prune rows for deleted files.

### Shallow clone cache

If the agent has `git` available, it can clone the knowledge store into `.giterloper/cache/repo/` with `--depth 1` and read everything locally. INSTRUCTIONS should say to use this when API budget is insufficient (e.g. bulk indexing) and to refresh with `git -C .giterloper/cache/repo fetch --depth 1 origin <default_branch>`.

The shallow clone is also the recommended way to **obtain content for building the index** — one `git clone --depth 1` gives you all knowledge files locally, then you walk them and populate the SQLite database.

### Submodules

Users may add the knowledge store as a git submodule. The instructions can mention this as an option but should note: submodules pull history by default; shallow submodules are not universally well supported. Do not recommend submodules as the default retrieval method.
