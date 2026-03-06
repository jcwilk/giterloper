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
