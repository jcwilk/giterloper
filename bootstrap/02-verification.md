## Verification

After setup:

1. **Prerequisites:** Confirm `git` and QMD are installed (`git --version`, `qmd status`).
2. **Clone:** Confirm the clone exists at `.giterloper/repos/main/` (or your chosen path) with `knowledge/`, `CONSTITUTION.md`, and `INSTRUCTIONS.md`. Verify constitution with `CONSTITUTION.md5` from the store.
3. **Gitignore:** If applicable, confirm the clone path is in `.gitignore`.
4. **QMD collection:** Confirm `qmd collection list` shows the collection. Run `qmd search "<topic>" -c <store-name>@main` to verify results.
5. **General access:** Follow guidelines in `INSTRUCTIONS.md` to perform an `answer_from_context` query relevant to the knowledge store and present it to the user.

If anything is missing or incorrect, inform the user and if they give you permission to proceed, repeat the relevant step and retry verification.
