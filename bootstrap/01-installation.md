## Installation steps

### 1. Ensure prerequisites

Content is accessed via a depth=1 clone and searched with QMD. Check availability:

1. **git** (required): Run `git --version`. Install via system package manager if needed.
2. **Node.js >= 22 or Bun >= 1.0:** Run `node --version` or `bun --version`. QMD requires one of these.
3. **QMD:** Run `qmd status`. If not installed: `npm install -g @tobilu/qmd` (or `bun install -g @tobilu/qmd`).

### 2. Clone the knowledge store

Follow the clone procedure in this store's `INSTRUCTIONS.md`. That file is the canonical source for clone commands, paths, and layout — it will evolve as the store evolves. Use the user-confirmed path for where to store it.

Moving forward, use the `CONSTITUION.md`, `INSTRUCTIONS.md`, and `boostrap/` from that checked out version to avoid github API limits.

### 3. Add .gitignore entries (if desired)

If the project should not commit the cloned store, add the giterloper root to `.gitignore`:

```
.giterloper/
```

Or whichever path the user directed you to use.

### 4. Set up QMD (present commands; do not auto-run)

See this store's `INSTRUCTIONS.md` about how to index a new checked out version into QMD.
