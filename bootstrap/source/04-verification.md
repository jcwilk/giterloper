## Verification

After installation:

1. **Constitution:** Confirm `.giterloper/constitution.md` exists and its MD5 matches CONSTITUTION.md5 from the source repo.
2. **Gitignore:** Confirm `.giterloper/cache/`, `.giterloper/auth`, and `.giterloper/index.db` (and `*.sqlite` if used) are listed in `.gitignore`.
3. **INSTRUCTIONS:** Confirm INSTRUCTIONS.md exists and describes the six operations and the retrieval strategy (API first, clone fallback, index when present). Confirm it names the knowledge store and its URL or location.
4. **Optional:** If a token was configured, confirm `.giterloper/auth` exists and is not tracked by git.

If anything is missing or incorrect, repeat the relevant step. Do not commit the auth file or cache contents.
