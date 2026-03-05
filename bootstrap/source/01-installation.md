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
