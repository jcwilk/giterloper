## Installation steps

### 1. Ensure prerequisites

The index and cache system requires SQLite. Check availability and install if needed:

1. **Python `sqlite3` (preferred):** Run `python3 -c "import sqlite3; print(sqlite3.sqlite_version)"`. If this works, Python will be used for index operations. Almost all Python installations include this module.
2. **`sqlite3` CLI:** Run `sqlite3 --version`. This is an alternative for environments without Python.
3. **If neither is available:** Install via the system package manager:
   - Debian/Ubuntu: `apt install -y sqlite3 python3`
   - macOS: `brew install sqlite3` (Python is usually pre-installed)
   - Alpine: `apk add sqlite python3`
   - Or install any available Python (3.6+), which bundles `sqlite3`.
4. **If nothing can be installed** (restricted environment): Proceed without an index. The retrieval strategy will fall back to tree-based folder name matching and direct file reads, which still works but uses more API calls.

Also verify that `git` is available (`git --version`) since the shallow-clone fallback and write operations depend on it. If `git` is not available, retrieval is limited to the GitHub API.

### 2. Create the giterloper directory

Create the directory you chose (e.g. `.giterloper/`) in the project root. Ensure the name and location match project conventions.

### 3. Copy the constitution

Copy the constitution file from the source repository **verbatim** into the giterloper directory. The file in the project should be named `constitution.md` (lowercase) inside the giterloper directory. Do not modify the content.

**Verification:** Fetch `CONSTITUTION.md5` from the same source. Compute the MD5 of the copied file and compare. If they differ, the copy is invalid; re-copy from the canonical source.

### 4. Add .gitignore entries

Add (or merge) these entries to the project root `.gitignore` so generated and sensitive files are not committed:

```
.giterloper/cache/
.giterloper/index.db
.giterloper/*.sqlite
.giterloper/auth
```

Use the actual path if you chose something other than `.giterloper/`. The directory itself and `constitution.md` (and any other checked-in config) should remain tracked.

### 5. Create the cache directory (optional but recommended)

Create the cache directory (e.g. `.giterloper/cache/`) so that API-fetched or cloned content and index databases have a place to live. It is gitignored.

### 6. GitHub token (optional)

If the knowledge store is on GitHub and the user wants higher API rate limits (5,000/hr vs 60/hr unauthenticated), ask whether to configure a token. If yes:

- Have the user create a personal access token (or use an existing one) with `repo` scope for private repos, or no scope for public-only.
- Store the token in `.giterloper/auth` (one line, the token only) or document that they may set `GITHUB_TOKEN` (or similar) in the environment. Ensure `.giterloper/auth` is in `.gitignore` and never commit it.

If the user declines, proceed with unauthenticated access; the INSTRUCTIONS you generate should mention the 60/hr limit and aggressive caching.

### 7. Generate or adapt INSTRUCTIONS.md

The project needs instructions that tell an agent how to perform the six giterloper operations (answer_from_context, retrieve_relevant_context, verify_claim, add_knowledge, subtract_knowledge, intersect_knowledge) when the **knowledge store** is the one you're installing from (or another specified store). All operations accept raw string or asset reference inputs. See the "Instructions template" section below for what to include. Place INSTRUCTIONS.md either at the project root or inside the giterloper directory, depending on project norms. If the project already has an INSTRUCTIONS.md, merge or append a giterloper section rather than overwriting.

### 8. Build the initial index (recommended)

If SQLite is available (step 1), build the index now so that operations work efficiently from the start. Follow the "Building the index" section in INSTRUCTIONS.md:

1. Clone the knowledge store into `.giterloper/cache/repo/` with `git clone --depth 1 <repo_url>` (or use API-fetched content).
2. Create `.giterloper/cache/index.db` with the schema from INSTRUCTIONS.md.
3. Walk all files under `knowledge/`, chunk them into atomic units per INSTRUCTIONS.md's chunking strategy, and insert rows into the `files` and `chunks` tables.
4. Verify the index works: run a test query (e.g. `SELECT count(*) FROM chunks;` should return > 0).

If SQLite is not available, skip this step. The INSTRUCTIONS.md retrieval strategy will fall back to API or clone-based retrieval.

**Confirm with the user** (in interactive mode): directory location, constitution source URL, whether to add a GitHub token, and where INSTRUCTIONS.md should live.
