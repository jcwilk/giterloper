## Verification

After setup:

1. **Prerequisites:** Confirm `git` and QMD are installed (`git --version`, `qmd status`).
2. **pinned.yaml:** Confirm `.giterloper/pinned.yaml` exists and contains the expected store entry (e.g. `giterloper: github.com/jcwilk/giterloper@main`).
3. **Clone:** Confirm the clone exists at `.giterloper/versions/<name>/<ref>/` (e.g. `.giterloper/versions/giterloper/main/`) with `knowledge/`, `CONSTITUTION.md`, and `INSTRUCTIONS.md`. Verify constitution with `CONSTITUTION.md5` from the store.
4. **Gitignore:** Confirm `.giterloper/versions/` is in `.gitignore` (not the entire `.giterloper/` directory — `pinned.yaml` should be committed).
5. **QMD collection:** Confirm `qmd collection list` shows the collection. Run `qmd search "<topic>" -c <name>@<ref>` to verify results.
6. **General access:** Follow guidelines in `INSTRUCTIONS.md` to perform an `answer_from_context` query relevant to the knowledge store and present it to the user.

If anything is missing or incorrect, inform the user and if they give you permission to proceed, repeat the relevant step and retry verification.
