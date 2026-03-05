## Optional infrastructure

### Index database

For faster retrieval without hitting the API repeatedly, the project can maintain a SQLite index in `.giterloper/cache/index.db`. The index might include:

- File path (relative to repo root or knowledge root)
- Extracted keywords or a short summary
- Optional content hash for change detection

Build the index by walking the knowledge store (via API or local clone), parsing markdown (or other) files, and inserting rows. Rebuild after ingestion or when the store is updated. Document the schema and rebuild steps in INSTRUCTIONS.md so agents can "rebuild index" when the cache is stale.

### Shallow clone cache

If the agent has `git` available, it can clone the knowledge store into `.giterloper/cache/repo/` with `--depth 1` and read everything locally. INSTRUCTIONS should say to use this when API budget is insufficient (e.g. bulk indexing) and to refresh with `git -C .giterloper/cache/repo fetch --depth 1 origin <default_branch>`.

### Submodules

Users may add the knowledge store as a git submodule. The instructions can mention this as an option but should note: submodules pull history by default; shallow submodules are not universally well supported. Do not recommend submodules as the default retrieval method.
