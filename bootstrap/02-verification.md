# Verification

After setup, prefer CLI-driven checks first, then manual fallbacks.

1. **CLI diagnostic**
   - Run: `./.cursor/skills/gl/scripts/gl diagnostic`
   - Confirm expected pin exists, clone path exists, collection is healthy, and vectors are non-zero.

2. **Extended checks (optional)**
   - Run: `./.cursor/skills/gl/scripts/gl-extended status` for detailed state.
   - Run: `./.cursor/skills/gl/scripts/gl-extended verify` for per-pin health.

3. **Manual fallback checks (if needed)**
   - `git --version`, `qmd status`
   - `.giterloper/pinned.yaml` exists and pin uses full 40-character SHA
   - `.giterloper/versions/<name>/<sha>/` exists with `knowledge/`, `CONSTITUTION.md`, `INSTRUCTIONS.md`
   - `.gitignore` includes `.giterloper/versions/` and `.giterloper/staged/`
   - `qmd collection list` contains `<name>@<sha>`
   - `qmd status` indicates vectors are non-zero for that collection
   - `qmd search "<topic>" -c <name>@<sha>` returns relevant matches

4. **Operational sanity**
   - Run a simple read operation: `./.cursor/skills/gl/scripts/gl search "<topic>"` or `./.cursor/skills/gl/scripts/gl query "<question>"` and confirm grounded output with path citations.

If verification fails, report exactly which check failed and rerun only the relevant setup step.
