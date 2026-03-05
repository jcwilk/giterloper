## Instructions template

The INSTRUCTIONS.md you create for the project should cover the following. Adapt to the actual knowledge store URL and structure.

1. **Retrieval strategy**
   - Prefer GitHub API: one tree call, then fetch only needed files. Cache everything under the giterloper cache directory.
   - Rate limits: unauthenticated ~60/hr; with token in `.giterloper/auth` or `GITHUB_TOKEN`, ~5,000/hr.
   - Fallback: shallow clone into `.giterloper/cache/repo/` with `git clone --depth 1` if bulk access is needed.
   - If `.giterloper/cache/index.db` exists, use it first to find relevant files.

2. **Operations** (all accept raw string or asset reference for inputs; enables combining stores)
   - **answer_from_context:** Use only scoped content; no outside assumptions. Question as string; scope as asset ref (default: this store). Discover via tree/index, read relevant files, answer and cite.
   - **retrieve_relevant_context:** Same discovery; return summarized excerpts and paths for the query. Query as string; scope as asset ref (default: this store).
   - **verify_claim:** Find relevant content; state supported / contradicted / not addressed. Claim as string; scope as asset ref (default: this store).
   - **add_knowledge:** Add and reconcile content. Knowledge as raw string or asset reference. Place content, adjust folder structure (underscore-separated names), update index if present, commit.
   - **subtract_knowledge:** Remove content that overlaps with the passed knowledge (raw string or asset reference). Keep the rest.
   - **intersect_knowledge:** Keep only content that overlaps with the passed knowledge (raw string or asset reference). Remove everything else.

3. **Store-specific details**
   - Config: link or mention `giterloper.yaml` at the store root (name, topic, description).
   - Knowledge root: typically `knowledge/` with self-identifying folder names. Describe the actual layout of the store you're installing from.
   - Constitution: `.giterloper/constitution.md` is a verbatim copy; verify with CONSTITUTION.md5 from the store repo.

4. **Index (optional)**
   - Describe how to build or rebuild a SQLite index in `.giterloper/cache/index.db` from the store contents (paths, keywords, summaries) so that most queries need 1–2 file reads. Rebuild when the store changes.

Example opening paragraph: "This project has giterloper installed to access the [Name] knowledge store, which contains knowledge about [topic/description]. The store is at [repo URL]. Perform the six operations (answer_from_context, retrieve_relevant_context, verify_claim, add_knowledge, subtract_knowledge, intersect_knowledge) by following the retrieval strategy below and the operation descriptions. All operations accept raw string or asset reference inputs."
