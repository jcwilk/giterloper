## Verification

After installation:

1. **Prerequisites:** Confirm `git` is installed (`git --version`). Confirm QMD is installed (`qmd status`).
2. **Constitution:** Confirm `.giterloper/constitution.md` exists and its MD5 matches CONSTITUTION.md5 from the source repo.
3. **Gitignore:** Confirm `.giterloper/repos/` is listed in `.gitignore`.
4. **Clone:** Confirm the clone exists at `.giterloper/repos/main/` with a `knowledge/` directory and content.
5. **QMD collection:** Confirm `qmd collection list` shows the collection (e.g. `<store-name>@main`). Run `qmd search "<topic>" -c <store-name>@main` to verify results are returned.
6. **INSTRUCTIONS:** Confirm INSTRUCTIONS.md exists and describes the six operations, clone-based access, QMD search patterns, and multi-version usage. Confirm it names the knowledge store and its URL or location.

If anything is missing or incorrect, repeat the relevant step.
