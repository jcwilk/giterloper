# Retrieval and search

This folder holds knowledge about how giterloper knowledge stores are accessed and searched.

- **Clone-based access:** Knowledge stores are accessed by cloning with `--depth 1` into `.giterloper/repos/<ref>/`. Each ref (branch, tag, SHA) gets its own directory. No API calls, no complex tiering.
- **QMD for search:** QMD indexes the `knowledge/` directory from the clone. It provides keyword search (FTS5/BM25), optional semantic search (vector embeddings), and hybrid search with reranking. Each version gets its own QMD collection named `<store>@<ref>`.
- **Multi-version access:** Operations that combine stores (add, subtract, intersect with asset references) clone a second version alongside the first. Both are independently searchable via separate QMD collections.
- **Updating:** Pull upstream changes into the clone and re-index with `qmd update --pull`.
