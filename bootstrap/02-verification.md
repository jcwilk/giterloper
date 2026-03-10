# Verification

After setup, prefer CLI-driven checks first, then manual fallbacks.

1. **CLI diagnostic (main gl)**
   - Run: `./.cursor/skills/gl/scripts/gl diagnostic`
   - Confirm it passes for expected pin(s) (clone, collection, vectors, branch freshness).

2. **CLI status (gl-extended, if more detail needed)**
   - Run: `./.cursor/skills/gl/scripts/gl-extended status`
   - Confirm expected pin exists, clone path exists, and collection name is `<name>@<sha>`.

3. **Manual fallback checks (if needed)**
   - `git --version`, `qmd status`
   - `.giterloper/pinned.yaml` exists and pin uses full 40-character SHA
   - `.giterloper/versions/<name>/<sha>/` exists with `knowledge/`, `CONSTITUTION.md`, `INSTRUCTIONS.md`
   - `.gitignore` includes `.giterloper/versions/` and `.giterloper/staged/`
   - `qmd collection list` contains `<name>@<sha>`
   - `qmd status` indicates vectors are non-zero for that collection
   - `qmd search "<topic>" -c <name>@<sha>` returns relevant matches

4. **Operational sanity**
   - Run a simple read operation via the skill (`./.cursor/skills/gl/scripts/gl search` or `./.cursor/skills/gl/scripts/gl query`) and confirm grounded output with path citations.

If verification fails, report exactly which check failed and rerun only the relevant setup step.
