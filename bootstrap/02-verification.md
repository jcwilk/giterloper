# Verification

After setup, prefer CLI-driven checks first, then manual fallbacks.

1. **CLI diagnostic (main)**
   - Run: `./.cursor/skills/gl/scripts/gl diagnostic`
   - Confirm all pins report ok (clones, indexes, vectors, branch freshness).

2. **CLI status/verify (extended, for debugging)**
   - Run: `./.cursor/skills/gl/scripts/gl-extended status` for detailed state.
   - Run: `./.cursor/skills/gl/scripts/gl-extended verify` for explicit verification.

3. **Manual fallback checks (if needed)**
   - `git --version`, `qmd status`
   - `.giterloper/pinned.yaml` exists and pin uses full 40-character SHA
   - `.giterloper/versions/<name>/<sha>/` exists with `knowledge/`, `CONSTITUTION.md`, `INSTRUCTIONS.md`
   - `.gitignore` includes `.giterloper/versions/` and `.giterloper/staged/`
   - `qmd collection list` contains `<name>@<sha>`
   - `qmd status` indicates vectors are non-zero for that collection
   - `qmd search "<topic>" -c <name>@<sha>` returns relevant matches

4. **Operational sanity**
   - Run a simple read operation via the skill (`./.cursor/skills/gl/scripts/gl search <terms>` or `./.cursor/skills/gl/scripts/gl query <question>`) and confirm grounded output with path citations.

If verification fails, report exactly which check failed and rerun only the relevant setup step.
