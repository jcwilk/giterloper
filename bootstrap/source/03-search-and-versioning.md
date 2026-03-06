## Search and versioning

### QMD overview

QMD indexes and searches markdown knowledge files. It provides:

- **FTS5/BM25 keyword search** — Fast full-text search, no external models
- **Optional vector semantic search** — Embeddings (~2GB) for similarity search
- **Smart markdown chunking** — ~900 tokens per chunk, 15% overlap, respects headings and code blocks
- **Local-first** — Index stored at `~/.cache/qmd/index.sqlite`; no external services

Collections point at directories. For giterloper, each clone version gets its own collection.

### Search modes

| Command | Purpose | Models needed |
|---------|---------|---------------|
| `qmd search "<keywords>"` | Keyword search (BM25) | None |
| `qmd vsearch "<query>"` | Vector semantic search | Embeddings |
| `qmd query "<question>"` | Hybrid + reranking, best quality | Embeddings + reranker |

Scope to a collection with `-c <store>@<ref>`. Use `qmd get "<path>"` to retrieve full document content.

### Multi-version layout

Each ref (branch, tag, SHA) lives in its own directory:

```
.giterloper/
  repos/
    main/        # Default branch
    v1.0.0/      # Tagged release
    feature-x/   # Another branch
```

Each version gets its own QMD collection: `<store-name>@main`, `<store-name>@v1.0.0`, etc. Searching one version never returns results from another.

**When two versions are needed at once** (e.g., `add_knowledge` from one store into another, or `subtract_knowledge` / `intersect_knowledge` comparing versions):

1. Clone the second ref: `git clone --depth 1 --branch <ref> <url> .giterloper/repos/<ref>/`
2. Add its QMD collection: `qmd collection add .giterloper/repos/<ref>/knowledge --name <store>@<ref> --mask "**/*.md"`
3. Search each independently: `qmd search "..." -c <store>@main` and `qmd search "..." -c <store>@<ref>`

### Updating

After pulling upstream changes or modifying files locally:

```sh
git -C .giterloper/repos/main/ fetch --depth 1 origin main
git -C .giterloper/repos/main/ reset --hard origin/main
qmd update
```

Or: `qmd update --pull` (QMD runs git pull in the collection directory, then re-indexes).

### MCP server (optional)

For tighter agent integration, QMD can run as an MCP server: `qmd mcp`. Exposes tools like `qmd_search`, `qmd_vector_search`, `qmd_deep_search`, `qmd_get`. See QMD docs for configuration.
