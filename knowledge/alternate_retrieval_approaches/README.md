# Alternate retrieval approaches

This folder holds knowledge about different ways to access or index a giterloper knowledge store.

- **GitHub API (primary):** Fetch tree in one call, then only the files needed. Respect rate limits (60/hr unauthenticated, 5000/hr with token). Cache fetched content under `.giterloper/cache/`.
- **Shallow clone:** Clone with `--depth 1` into `.giterloper/cache/repo/` when you need bulk access or indexing. Avoids pulling long history; reuse the clone across sessions.
- **Local index:** A SQLite index (e.g. `.giterloper/cache/index.db`) can store paths, keywords, and summaries so most queries are answered with one or two file reads. Rebuild when the store changes.
- **Submodules:** Optional; pin a folder to a commit via git submodules. Not recommended as default because history fetch can be heavy and shallow submodules are fragile on some hosts.
