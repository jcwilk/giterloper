## Cursor Cloud specific instructions

This repository is **Giterloper** — a Git-backed knowledge storage paradigm. It is not a traditional application with build/lint/test steps. The codebase is pure Markdown documentation plus a Cursor skill.

### What this repo contains

- `CONSTITUTION.md` — the paradigm specification (v1.1.0)
- `INSTRUCTIONS.md` — how to perform operations on this knowledge store
- `bootstrap/` — step-by-step guide for connecting a target project to a store
- `knowledge/` — the actual knowledge content (Markdown files)
- `.cursor/skills/persist/SKILL.md` — Cursor skill for committing changes

### Core tool: QMD

The CLI tool **QMD** (`@tobilu/qmd`) is the primary way to interact with the knowledge store. It provides keyword search (FTS5/BM25), vector/semantic search, and hybrid query expansion+reranking using local ML models.

Install: `npm install -g @tobilu/qmd`

### Indexing the knowledge store

After installing QMD, index the repo's `knowledge/` directory. The collection name follows the pattern `giterloper@<full-SHA>`:

```sh
SHA=$(git rev-parse HEAD)
qmd collection add ./knowledge --name "giterloper@$SHA" --mask "**/*.md"
qmd context add "qmd://giterloper@$SHA" "Giterloper knowledge store about the giterloper paradigm itself"
qmd embed
```

### Running QMD commands

- `qmd search "<keywords>" -c giterloper@<SHA> --json` — fast keyword search
- `qmd query "<question>" -c giterloper@<SHA> --json` — hybrid search with query expansion and reranking (slower, needs ML models)
- `qmd vsearch "<query>" -c giterloper@<SHA> --json` — vector semantic search
- `qmd get "<path>" -c giterloper@<SHA> --full` — retrieve full document content

### Environment caveats

- **No GPU in Cloud VM**: `node-llama-cpp` will attempt a CUDA build that fails (no CUDA Toolkit). It falls back to CPU automatically. The CUDA build failure noise in stderr is expected and harmless.
- **libstdc++ symlink**: The Cloud VM may be missing `/usr/lib/x86_64-linux-gnu/libstdc++.so` (needed by the C++ linker for `node-llama-cpp`). The update script creates this symlink. If `qmd` commands fail with a C++ linker error about `-lstdc++`, run: `sudo ln -sf /usr/lib/x86_64-linux-gnu/libstdc++.so.6 /usr/lib/x86_64-linux-gnu/libstdc++.so`
- **Model downloads**: First use of `qmd query` or `qmd vsearch` downloads ~1 GB of ML models to `~/.cache/qmd/models/`. Use generous timeouts (60s+) for first runs.
- **No lint/test/build**: This is a documentation-only repo. There are no linters, test suites, or build steps configured.
