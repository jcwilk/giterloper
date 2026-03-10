# Verification

After setup, prefer CLI-driven checks first, then manual fallbacks.

1. **CLI status**
   - Run: `deno run -A lib/gl.ts status`
   - Confirm expected pin exists, clone path exists, and collection name is `<name>@<sha>`.

2. **CLI verify**
   - Run: `deno run -A lib/gl.ts verify`
   - Confirm it passes for expected pin(s).

3. **Manual fallback checks (if needed)**
   - `git --version`, `qmd status`
   - `.giterloper/pinned.yaml` exists and pin uses full 40-character SHA
   - `.giterloper/versions/<name>/<sha>/` exists with `knowledge/`, `CONSTITUTION.md`, `INSTRUCTIONS.md`
   - `.gitignore` includes `.giterloper/versions/` and `.giterloper/staged/`
   - `qmd collection list` contains `<name>@<sha>`
   - `qmd status` indicates vectors are non-zero for that collection
   - `qmd search "<topic>" -c <name>@<sha>` returns relevant matches

4. **Operational sanity**
   - Run a simple read operation via the skill (`deno run -A lib/gl.ts search` or `deno run -A lib/gl.ts query`) and confirm grounded output with path citations.

If verification fails, report exactly which check failed and rerun only the relevant setup step.
