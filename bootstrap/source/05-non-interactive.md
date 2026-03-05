## Non-interactive mode: contingency handling

When installing without user confirmation (e.g. "yolo" or CI), you must make safe defaults and handle failures without prompting.

### Defaults

- **Prerequisites:** Silently check for Python `sqlite3` module, then `sqlite3` CLI. If neither is found, attempt installation via the system package manager only if it can be done non-interactively (e.g. `apt install -y sqlite3` in a CI container). If installation fails or is not possible, skip the index build and note in INSTRUCTIONS that the index is not yet built and should be created when SQLite becomes available.
- **Directory:** Use `.giterloper/` at the repository root unless the project already has a different giterloper path (e.g. existing `.giterloper/` or a config that names one). If in doubt, use `.giterloper/`.
- **Constitution source:** Use the same repository and branch that provided this bootstrap. Default branch is typically `main`. If CONSTITUTION.md and CONSTITUTION.md5 are at repo root, use those URLs.
- **GitHub token:** Do not create or write `.giterloper/auth` in non-interactive mode unless the token is provided via environment (e.g. `GITHUB_TOKEN`). If the env var is set, you may document in INSTRUCTIONS that authenticated access is available. Do not prompt for a token.
- **INSTRUCTIONS location:** Prefer project root `INSTRUCTIONS.md` if the project has no existing INSTRUCTIONS; otherwise place under `.giterloper/INSTRUCTIONS.md` or merge into existing docs as appropriate. Prefer not overwriting existing INSTRUCTIONS.md; append a "Giterloper" section or create `.giterloper/INSTRUCTIONS.md`.
- **Index build:** If SQLite is available, build the index automatically after cloning the store (step 8). If it fails (e.g. permissions, disk space), log the error in INSTRUCTIONS.md as a deferred step: "Index build failed; run the build procedure in INSTRUCTIONS.md manually when the issue is resolved."

### Failure handling

- **Constitution copy fails (e.g. 404):** Retry with default branch; if still failing, create INSTRUCTIONS that reference the intended source and note "constitution not yet installed; copy CONSTITUTION.md to .giterloper/constitution.md and verify with CONSTITUTION.md5."
- **MD5 mismatch:** Re-fetch the constitution from the canonical URL (no redirects or caches). If still mismatched, leave a note in INSTRUCTIONS that verification failed and the user should re-copy manually.
- **.gitignore missing or not writable:** Create or update only if you have write access. Otherwise document in INSTRUCTIONS that the user must add the giterloper entries to .gitignore.
- **Conflicting paths:** If `.giterloper/` already exists with different content, do not overwrite constitution.md. If the existing file matches CONSTITUTION.md5, skip copy. If not, create `.giterloper/constitution.md` only if the path is empty or you can write a side-by-side (e.g. `constitution.installed.md`) and document in INSTRUCTIONS.

### Heuristics for "where does giterloper live"

- If `giterloper.yaml` exists at root, this may be a giterloper store itself; prefer installing into a subdirectory or skip if it's the same repo.
- If `.giterloper/` exists and contains `constitution.md`, treat as already installed; only add or update INSTRUCTIONS and .gitignore if needed.
- If the project has a `docs/` or `tooling/` convention, you may place INSTRUCTIONS there and reference it from a short note in `.giterloper/README` or the root README.

Complete all steps that can be completed without user input; document any deferred steps (e.g. "Add a GitHub token to .giterloper/auth for higher rate limits") in INSTRUCTIONS.md.
