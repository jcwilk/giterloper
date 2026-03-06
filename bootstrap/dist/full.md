# Giterloper bootstrap

You are installing giterloper into a project so that agents working on that project can access a giterloper knowledge store. This document guides you through the installation.

## Before you start

1. **Examine the target project.** Note:
   - Language(s), framework(s), and existing documentation layout
   - Where config or tooling lives (root, `config/`, `docs/`, etc.)
   - Whether the project already has a `.giterloper/` directory or similar
   - Conventions for hidden vs visible directories (e.g. some prefer `giterloper/` at root instead of `.giterloper/`)

2. **Decide where giterloper will live.** The default is `.giterloper/` at the repository root. If the project standard is different (e.g. `tools/giterloper/`, `docs/.giterloper/`), adapt. The constitution copy and any generated files must live in one consistent place.

3. **Identify the source.** You need the URL of the giterloper knowledge store to install from (e.g. the repo that contains this bootstrap), and the path to the constitution and its MD5 file. Typically: same repo, `CONSTITUTION.md` and `CONSTITUTION.md5` at root.
## Installation steps

### 1. Ensure prerequisites

Content is accessed via a depth=1 clone and searched with QMD. Check availability:

1. **git** (required): Run `git --version`. Install via system package manager if needed:
   - Debian/Ubuntu: `apt install git`
   - macOS: `brew install git` (or Xcode Command Line Tools)
   - Alpine: `apk add git`
2. **Node.js >= 22 or Bun >= 1.0:** Run `node --version` or `bun --version`. QMD requires one of these:
   - Node.js: install via [nvm](https://github.com/nvm-sh/nvm) (`nvm install 22`), or system package manager
   - Bun: `curl -fsSL https://bun.sh/install | bash`
3. **QMD:** Run `qmd status`. If not installed: `npm install -g @tobilu/qmd` (or `bun install -g @tobilu/qmd`).

### 2. Create the giterloper directory

Create the directory you chose (e.g. `.giterloper/`) in the project root. Ensure the name and location match project conventions.

### 3. Copy the constitution

Copy the constitution file from the source repository **verbatim** into the giterloper directory. The file in the project should be named `constitution.md` (lowercase) inside the giterloper directory. Do not modify the content.

**Verification:** Fetch `CONSTITUTION.md5` from the same source. Compute the MD5 of the copied file and compare. If they differ, the copy is invalid; re-copy from the canonical source.

### 4. Add .gitignore entries

Add (or merge) this entry to the project root `.gitignore` so cloned repositories are not committed:

```
.giterloper/repos/
```

Use the actual path if you chose something other than `.giterloper/`. The directory itself and `constitution.md` (and any other checked-in config) should remain tracked.

### 5. Clone the knowledge store

Clone the store with depth 1 into the repos directory. The default ref is `main`:

```sh
git clone --depth 1 <repo_url> .giterloper/repos/main/
```

Use the actual giterloper path and repo URL. For a different ref (branch, tag): `git clone --depth 1 --branch <ref> <repo_url> .giterloper/repos/<ref>/`.

### 6. Set up QMD (present commands; do not auto-run)

Per QMD's design, do not automatically run `qmd collection add`, `qmd embed`, or `qmd update`. Instead, present these commands for the user to execute:

```sh
# Create QMD collection for the knowledge directory
qmd collection add .giterloper/repos/main/knowledge --name <store-name>@main --mask "**/*.md"

# Add context from giterloper.yaml description
qmd context add qmd://<store-name>@main "<store description>"

# (Optional) Generate embeddings for semantic search (~2GB models)
qmd embed
```

Replace `<store-name>` with the store name from `giterloper.yaml` and `<store description>` with the `description` field.

### 7. Generate or adapt INSTRUCTIONS.md

The project needs instructions that tell an agent how to perform the six giterloper operations (answer_from_context, retrieve_relevant_context, verify_claim, add_knowledge, subtract_knowledge, intersect_knowledge) when the **knowledge store** is the one you're installing from (or another specified store). All operations accept raw string or asset reference inputs. See the "Instructions template" section below for what to include. Place INSTRUCTIONS.md either at the project root or inside the giterloper directory, depending on project norms. If the project already has an INSTRUCTIONS.md, merge or append a giterloper section rather than overwriting.

**Confirm with the user** (in interactive mode): directory location, constitution source URL, and where INSTRUCTIONS.md should live.
## Instructions template

The INSTRUCTIONS.md you create for the project should cover the following. Adapt to the actual knowledge store URL and structure. The source knowledge store's own INSTRUCTIONS.md (at the store root) is the reference implementation — consult it for QMD setup, search patterns, and per-operation usage.

1. **Access**
   - Content is accessed via a depth=1 clone at `.giterloper/repos/<ref>/` (default ref: `main`).
   - QMD indexes the `knowledge/` directory for search. Each version gets its own QMD collection named `<store>@<ref>`.
   - No API calls; clone and QMD only. See "QMD: setup, search, and maintenance" below.

2. **Operations** (all accept raw string or asset reference for inputs; enables combining stores)

   Each operation should describe **two paths**: the QMD path (when QMD collection exists) and the direct-read path (from the clone). Copy the per-operation instructions from the store's INSTRUCTIONS.md and adapt paths and store details as needed.

   - **answer_from_context:** Use `qmd search`/`qmd query` for chunks matching the question; `qmd get` for full files when needed. Fall back to reading files from the clone. Cite file paths and headings. No outside knowledge.
   - **retrieve_relevant_context:** Use `qmd search`/`qmd query` for 5-10 relevant chunks; return summaries and excerpts with paths. Fall back to folder-name-based file reads.
   - **verify_claim:** Use `qmd search`/`qmd query` broadly (keywords, synonyms) to find supporting and contradicting evidence. Check multiple results. Report supported / contradicted / not addressed with citations.
   - **add_knowledge:** Place content in appropriate folders; run `qmd update` after writing files. When combining with another version: clone that version, add its QMD collection, search both independently. Commit.
   - **subtract_knowledge:** Use `qmd search` to find overlapping chunks; remove overlapping content; run `qmd update`. Commit.
   - **intersect_knowledge:** Use `qmd search` to identify overlapping vs non-overlapping chunks; remove non-overlapping content; run `qmd update`. Commit.

3. **Store-specific details**
   - Config: link or mention `giterloper.yaml` at the store root (name, topic, description).
   - Knowledge root: typically `knowledge/` with self-identifying folder names. Describe the actual layout of the store you're installing from.
   - Constitution: `.giterloper/constitution.md` is a verbatim copy; verify with CONSTITUTION.md5 from the store repo.

4. **QMD: setup, search, and maintenance**

   This section should include, adapted from the store's INSTRUCTIONS.md:

   - **Prerequisites:** git, Node.js >= 22 or Bun >= 1.0, QMD (`npm install -g @tobilu/qmd`).
   - **Collection setup:** `qmd collection add .giterloper/repos/<ref>/knowledge --name <store>@<ref> --mask "**/*.md"`. Add context with `qmd context add qmd://<store>@<ref> "<description>"`.
   - **Search modes:** `qmd search` (keyword, fast, no models), `qmd query` (hybrid, best quality, needs embeddings), `qmd vsearch` (semantic only), `qmd get` (retrieve by path).
   - **Multi-version:** When combining operations need two versions, clone the second ref into `.giterloper/repos/<ref>/`, add its QMD collection, search each with `-c <store>@<ref>`.
   - **Maintenance:** `qmd update` to re-index after changes; `qmd update --pull` to pull upstream and re-index.

Example opening paragraph: "This project has giterloper installed to access the [Name] knowledge store, which contains knowledge about [topic/description]. The store is at [repo URL]. Perform the six operations (answer_from_context, retrieve_relevant_context, verify_claim, add_knowledge, subtract_knowledge, intersect_knowledge) by following the access and search guidance below. All operations accept raw string or asset reference inputs. Detailed QMD setup and search patterns are in the store's own INSTRUCTIONS.md at the repository root."
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
## Verification

After installation:

1. **Prerequisites:** Confirm `git` is installed (`git --version`). Confirm QMD is installed (`qmd status`).
2. **Constitution:** Confirm `.giterloper/constitution.md` exists and its MD5 matches CONSTITUTION.md5 from the source repo.
3. **Gitignore:** Confirm `.giterloper/repos/` is listed in `.gitignore`.
4. **Clone:** Confirm the clone exists at `.giterloper/repos/main/` with a `knowledge/` directory and content.
5. **QMD collection:** Confirm `qmd collection list` shows the collection (e.g. `<store-name>@main`). Run `qmd search "<topic>" -c <store-name>@main` to verify results are returned.
6. **INSTRUCTIONS:** Confirm INSTRUCTIONS.md exists and describes the six operations, clone-based access, QMD search patterns, and multi-version usage. Confirm it names the knowledge store and its URL or location.

If anything is missing or incorrect, repeat the relevant step.
