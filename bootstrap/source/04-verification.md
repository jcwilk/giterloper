## Verification

After installation:

1. **Prerequisites:** Confirm SQLite is available (`python3 -c "import sqlite3"` or `sqlite3 --version`). Confirm `git` is available if the shallow-clone fallback is needed.
2. **Constitution:** Confirm `.giterloper/constitution.md` exists and its MD5 matches CONSTITUTION.md5 from the source repo.
3. **Gitignore:** Confirm `.giterloper/cache/`, `.giterloper/auth`, and `.giterloper/index.db` (and `*.sqlite` if used) are listed in `.gitignore`.
4. **INSTRUCTIONS:** Confirm INSTRUCTIONS.md exists and describes the six operations, the retrieval strategy (index first, API second, clone fallback), the SQLite schema, the chunking strategy, and the build/query procedures. Confirm it names the knowledge store and its URL or location. Confirm it references the store's own INSTRUCTIONS.md for the canonical schema and chunking rules.
5. **Index:** If the index was built (step 8), confirm `.giterloper/cache/index.db` exists and contains data: `SELECT count(*) FROM chunks;` should return > 0. Run a test keyword query to verify results are returned.
6. **Optional:** If a token was configured, confirm `.giterloper/auth` exists and is not tracked by git.

If anything is missing or incorrect, repeat the relevant step. Do not commit the auth file or cache contents.
