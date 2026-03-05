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

### 1. Create the giterloper directory

Create the directory you chose (e.g. `.giterloper/`) in the project root. Ensure the name and location match project conventions.

### 2. Copy the constitution

Copy the constitution file from the source repository **verbatim** into the giterloper directory. The file in the project should be named `constitution.md` (lowercase) inside the giterloper directory. Do not modify the content.

**Verification:** Fetch `CONSTITUTION.md5` from the same source. Compute the MD5 of the copied file and compare. If they differ, the copy is invalid; re-copy from the canonical source.

### 3. Add .gitignore entries

Add (or merge) these entries to the project root `.gitignore` so generated and sensitive files are not committed:

```
.giterloper/cache/
.giterloper/index.db
.giterloper/*.sqlite
.giterloper/auth
```

Use the actual path if you chose something other than `.giterloper/`. The directory itself and `constitution.md` (and any other checked-in config) should remain tracked.

### 4. Create the cache directory (optional but recommended)

Create the cache directory (e.g. `.giterloper/cache/`) so that API-fetched or cloned content and index databases have a place to live. It is gitignored.

### 5. GitHub token (optional)

If the knowledge store is on GitHub and the user wants higher API rate limits (5,000/hr vs 60/hr unauthenticated), ask whether to configure a token. If yes:

- Have the user create a personal access token (or use an existing one) with `repo` scope for private repos, or no scope for public-only.
- Store the token in `.giterloper/auth` (one line, the token only) or document that they may set `GITHUB_TOKEN` (or similar) in the environment. Ensure `.giterloper/auth` is in `.gitignore` and never commit it.

If the user declines, proceed with unauthenticated access; the INSTRUCTIONS you generate should mention the 60/hr limit and aggressive caching.

### 6. Generate or adapt INSTRUCTIONS.md

The project needs instructions that tell an agent how to perform the six giterloper operations (answer_from_context, retrieve_relevant_context, verify_claim, add_knowledge, subtract_knowledge, intersect_knowledge) when the **knowledge store** is the one you're installing from (or another specified store). All operations accept raw string or asset reference inputs. See the "Instructions template" section below for what to include. Place INSTRUCTIONS.md either at the project root or inside the giterloper directory, depending on project norms. If the project already has an INSTRUCTIONS.md, merge or append a giterloper section rather than overwriting.

**Confirm with the user** (in interactive mode): directory location, constitution source URL, whether to add a GitHub token, and where INSTRUCTIONS.md should live.
## Instructions template

The INSTRUCTIONS.md you create for the project should cover the following. Adapt to the actual knowledge store URL and structure.

1. **Retrieval strategy**
   - Prefer GitHub API: one tree call, then fetch only needed files. Cache everything under the giterloper cache directory.
   - Rate limits: unauthenticated ~60/hr; with token in `.giterloper/auth` or `GITHUB_TOKEN`, ~5,000/hr.
   - Fallback: shallow clone into `.giterloper/cache/repo/` with `git clone --depth 1` if bulk access is needed.
   - If `.giterloper/cache/index.db` exists, use it first to find relevant files.

2. **Operations** (all accept raw string or asset reference for inputs; enables combining stores)
   - **answer_from_context:** Use only scoped content; no outside assumptions. Question as string; scope as asset ref (default: this store). Discover via tree/index, read relevant files, answer and cite.
   - **retrieve_relevant_context:** Same discovery; return summarized excerpts and paths for the query. Query as string; scope as asset ref (default: this store).
   - **verify_claim:** Find relevant content; state supported / contradicted / not addressed. Claim as string; scope as asset ref (default: this store).
   - **add_knowledge:** Add and reconcile content. Knowledge as raw string or asset reference. Place content, adjust folder structure (underscore-separated names), update index if present, commit.
   - **subtract_knowledge:** Remove content that overlaps with the passed knowledge (raw string or asset reference). Keep the rest.
   - **intersect_knowledge:** Keep only content that overlaps with the passed knowledge (raw string or asset reference). Remove everything else.

3. **Store-specific details**
   - Config: link or mention `giterloper.yaml` at the store root (name, topic, description).
   - Knowledge root: typically `knowledge/` with self-identifying folder names. Describe the actual layout of the store you're installing from.
   - Constitution: `.giterloper/constitution.md` is a verbatim copy; verify with CONSTITUTION.md5 from the store repo.

4. **Index (optional)**
   - Describe how to build or rebuild a SQLite index in `.giterloper/cache/index.db` from the store contents (paths, keywords, summaries) so that most queries need 1–2 file reads. Rebuild when the store changes.

Example opening paragraph: "This project has giterloper installed to access the [Name] knowledge store, which contains knowledge about [topic/description]. The store is at [repo URL]. Perform the six operations (answer_from_context, retrieve_relevant_context, verify_claim, add_knowledge, subtract_knowledge, intersect_knowledge) by following the retrieval strategy below and the operation descriptions. All operations accept raw string or asset reference inputs."
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
## Verification

After installation:

1. **Constitution:** Confirm `.giterloper/constitution.md` exists and its MD5 matches CONSTITUTION.md5 from the source repo.
2. **Gitignore:** Confirm `.giterloper/cache/`, `.giterloper/auth`, and `.giterloper/index.db` (and `*.sqlite` if used) are listed in `.gitignore`.
3. **INSTRUCTIONS:** Confirm INSTRUCTIONS.md exists and describes the six operations and the retrieval strategy (API first, clone fallback, index when present). Confirm it names the knowledge store and its URL or location.
4. **Optional:** If a token was configured, confirm `.giterloper/auth` exists and is not tracked by git.

If anything is missing or incorrect, repeat the relevant step. Do not commit the auth file or cache contents.
## Non-interactive mode: contingency handling

When installing without user confirmation (e.g. "yolo" or CI), you must make safe defaults and handle failures without prompting.

### Defaults

- **Directory:** Use `.giterloper/` at the repository root unless the project already has a different giterloper path (e.g. existing `.giterloper/` or a config that names one). If in doubt, use `.giterloper/`.
- **Constitution source:** Use the same repository and branch that provided this bootstrap. Default branch is typically `main`. If CONSTITUTION.md and CONSTITUTION.md5 are at repo root, use those URLs.
- **GitHub token:** Do not create or write `.giterloper/auth` in non-interactive mode unless the token is provided via environment (e.g. `GITHUB_TOKEN`). If the env var is set, you may document in INSTRUCTIONS that authenticated access is available. Do not prompt for a token.
- **INSTRUCTIONS location:** Prefer project root `INSTRUCTIONS.md` if the project has no existing INSTRUCTIONS; otherwise place under `.giterloper/INSTRUCTIONS.md` or merge into existing docs as appropriate. Prefer not overwriting existing INSTRUCTIONS.md; append a "Giterloper" section or create `.giterloper/INSTRUCTIONS.md`.

### Failure handling

- **Constitution copy fails (e.g. 404):** Retry with default branch; if still failing, create INSTRUCTIONS that reference the intended source and note "constitution not yet installed; copy CONSTITUTION.md to .giterloper/constitution.md and verify with CONSTITUTION.md5."
- **MD5 mismatch:** Re-fetch the constitution from the canonical URL (no redirects or caches). If still mismatched, leave a note in INSTRUCTIONS that verification failed and the user should re-copy manually.
- **.gitignore missing or not writable:** Create or update only if you have write access. Otherwise document in INSTRUCTIONS that the user must add the giterloper entries to .gitignore.
- **Conflicting paths:** If `.giterloper/` already exists with different content, do not overwrite constitution.md. If the existing file matches CONSTITUTION.md5, skip copy. If not, create `.giterloper/constitution.md` only if the path is empty or you can write a side-by-side (e.g. `constitution.installed.md`) and document in INSTRUCTIONS.

### Heuristics for "where does giterloper live"

- If `giterloper.yaml` exists at root, this may be a giterloper store itself; prefer installing into a subdirectory or skip if it's the same repo.
- If `.giterloper/` exists and contains `constitution.md`, treat as already installed; only add or update INSTRUCTIONS and .gitignore if needed.
- If the project has a `docs/` or `tooling/` convention, you may place INSTRUCTIONS there and reference it from a short note in `.giterloper/README` or the root README.

Complete all steps that can be completed without user input; document any deferred steps (e.g. "Add a GitHub token to .giterloper/auth for higher rate limits") in INSTRUCTIONS.md.
