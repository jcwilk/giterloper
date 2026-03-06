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
