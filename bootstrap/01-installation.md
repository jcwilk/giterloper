## Installation steps

STOP! IMPORTANT!

DO NOT START ACTUAL INSTALLATION UNTIL YOUR USER HAS CONFIRMED FROM THE PREAMBLE AND BEEN GIVEN THE OPPORTUNITY TO OVERRIDE DEFAULTS.

### 1. Ensure prerequisites

Content is accessed via a depth=1 clone and searched with QMD. Check availability:

1. **git** (required): Run `git --version`. Install via system package manager if needed.
2. **Node.js >= 22 or Bun >= 1.0:** Run `node --version` or `bun --version`. QMD requires one of these.
3. **QMD:** Run `qmd status`. If not installed: `npm install -g @tobilu/qmd` (or `bun install -g @tobilu/qmd`).

### 2. Create the giterloper directory and pinned.yaml

Create the giterloper root directory (default `.giterloper/`) and add a `pinned.yaml` file that maps this store's name to its reference:

```yaml
# .giterloper/pinned.yaml
<name>: <source>@<ref>
```

For example:

```yaml
giterloper: github.com/jcwilk/giterloper@main
```

The `<name>` is the human-friendly identifier chosen in the preamble. It determines the subdirectory name under `versions/`.

### 3. Add .gitignore entry for versions

Add the `versions/` subdirectory (not the entire giterloper root) to `.gitignore` so that cloned store content stays out of version control while `pinned.yaml` remains committed:

```
.giterloper/versions/
```

Or the equivalent path if the user chose a different giterloper root.

### 4. Add a giterloper section to the project README

Add a section to the target project's README (or equivalent documentation entry point) so that any agent encountering the project knows giterloper connections exist and how to materialize them. Use the user-confirmed giterloper root path throughout. Template:

```markdown
## Giterloper knowledge stores

This project uses [Giterloper](https://github.com/jcwilk/giterloper) knowledge stores. Store connections are defined in `<giterloper-root>/pinned.yaml`. Each entry maps a name to a store reference:

    <name>: <source>@<ref>

The value is split at the last `@` sign. Everything before it is the **source** (a Git-hostable path such as `github.com/owner/repo`). Everything after it is the **ref** (a Git branch, tag, or commit SHA — e.g. `main`, `v1.2.0`, or a full SHA). The ref may contain slashes (e.g. `feature/topic`), so always split on the *last* `@`.

Cloned stores live under `<giterloper-root>/versions/` and are gitignored. To materialize them, for each entry in `pinned.yaml`:

    git clone --depth 1 --branch <ref> https://<source> <giterloper-root>/versions/<name>/<ref>

Then follow the `INSTRUCTIONS.md` inside each clone to set up QMD indexing.
```

Replace `<giterloper-root>` with the actual path (e.g. `.giterloper`). The goal is just enough information for an agent to find `pinned.yaml`, parse it, and reify the gitignored clones without any prior knowledge of giterloper.

### 5. Clone the knowledge store

Follow the clone procedure in this store's `INSTRUCTIONS.md`. That file is the canonical source for clone commands, paths, and layout — it will evolve as the store evolves. The clone destination should be `<giterloper-root>/versions/<name>/<ref>/` matching the entry in `pinned.yaml`.

Moving forward, use the `CONSTITUTION.md`, `INSTRUCTIONS.md`, and `bootstrap/` from that checked-out version to avoid GitHub API limits.

### 6. Set up QMD (present commands; do not auto-run)

See this store's `INSTRUCTIONS.md` about how to index a new checked-out version into QMD.

### 7. Surface operations to agents

Implement the surface method chosen during the preamble. The goal is to give agents working in the target project clear instructions for discovering and invoking the knowledge store's operations. The store's `INSTRUCTIONS.md` is the canonical reference for how each operation works — adapt its content into the format the user chose.

If the user chose **custom documentation**, follow their instructions exactly and skip the templates below.

For all other methods, include the **read operations** by default. Only include write operations if the user explicitly opted in during the preamble.

#### Option A: AGENTS.md

Add a giterloper section to the project's `AGENTS.md` (create the file if it doesn't exist). Use the user-confirmed giterloper root path, store name, and ref throughout.

Template (adapt as needed):

```markdown
## Giterloper knowledge store

This project is connected to a [giterloper](https://github.com/jcwilk/giterloper) knowledge store. Store connections are defined in `<giterloper-root>/pinned.yaml`.

If the store is not materialized locally, clone and index it following the instructions in the project README's giterloper section.

### Read operations

**answer_from_context** — Answer a question using only knowledge store content.

1. Run `qmd query "<question>" -c <name>@<ref> --json` or `qmd search "<keywords>" -c <name>@<ref> --json -n 10`.
2. Use `qmd get "<path>" -c <name>@<ref> --full` for deeper context on promising results.
3. Compose an answer from retrieved content only. Cite file paths and headings.

**retrieve_relevant_context** — Retrieve background information for a query.

1. Run `qmd search` or `qmd query` for 5–10 results. Run multiple searches if the query spans topics.
2. Use `qmd get` for broader context when needed.
3. Return a summary and/or key excerpts with file paths.

**verify_claim** — Check whether a claim is supported by the knowledge store.

1. Extract key concepts as keywords.
2. Run `qmd search` or `qmd query` broadly; try synonyms.
3. Check multiple results for supporting and contradicting evidence.
4. Report supported / contradicted / not addressed with citations.
```

If write operations are enabled, append a write operations section following the procedures in `INSTRUCTIONS.md` (working clone workflow, branch naming, commit/push, QMD update, user notification).

#### Option B: Agent Skills (open standard)

Create a skill folder at `.agents/skills/<name>/` (where `<name>` matches the store name) containing a `SKILL.md`. Use the open Agent Skills format with YAML frontmatter.

Template (adapt as needed):

```markdown
---
name: <name>
description: "Access the <name> giterloper knowledge store. Use when you need to answer questions from, retrieve context from, or verify claims against the project's knowledge store."
---

# <name> knowledge store

This skill provides access to a giterloper knowledge store connected via `<giterloper-root>/pinned.yaml`.

## When to use

- When you need authoritative answers grounded in the knowledge store
- When you need background context or source material from the store
- When you need to verify a claim against stored knowledge

## Prerequisites

- The store must be cloned and indexed. If `<giterloper-root>/versions/<name>/<ref>/` does not exist, follow the project README's giterloper section to materialize it.
- QMD must be installed and the collection must be registered (`qmd collection list` should show `<name>@<ref>`).

## Operations

### answer_from_context

1. Run `qmd query "<question>" -c <name>@<ref> --json` or `qmd search "<keywords>" -c <name>@<ref> --json -n 10`.
2. Use `qmd get "<path>" -c <name>@<ref> --full` for deeper context.
3. Compose an answer from retrieved content only. Cite file paths and headings.

### retrieve_relevant_context

1. Run `qmd search` or `qmd query` for 5–10 results.
2. Use `qmd get` for broader context when needed.
3. Return a summary and/or key excerpts with file paths.

### verify_claim

1. Extract key concepts as keywords.
2. Run `qmd search` or `qmd query` broadly; try synonyms.
3. Check multiple results for supporting and contradicting evidence.
4. Report supported / contradicted / not addressed with citations.
```

If write operations are enabled, add write operation sections following the procedures in `INSTRUCTIONS.md`.

#### Option C: Cursor-specific skills

Create a skill folder at `.cursor/skills/<name>/` containing a `SKILL.md`. The format is the same as Option B (Agent Skills) since Cursor supports the same `SKILL.md` frontmatter and structure. The only difference is the directory — `.cursor/skills/` is automatically discovered by Cursor.

Use the same template as Option B, placed under `.cursor/skills/<name>/SKILL.md`.

#### Adapting to custom instructions

If the user provided custom documentation guidance, implement it faithfully. Use the operation descriptions from `INSTRUCTIONS.md` as source material but restructure, reword, or relocate them as the user directed. When the user's instructions are ambiguous, ask for clarification rather than guessing.
