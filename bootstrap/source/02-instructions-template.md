## Instructions template

The INSTRUCTIONS.md you create for the project should cover the following. Adapt to the actual knowledge store URL and structure. The source knowledge store's own INSTRUCTIONS.md (at the store root) is the reference implementation — consult it for the full SQLite schema, chunking strategy, and per-operation index query patterns. The template below tells you what sections to include; fill in the details from the store's INSTRUCTIONS.md.

1. **Retrieval strategy** (tiered, check in order)
   - **Local index first:** If `.giterloper/cache/index.db` exists, query it to find relevant files and chunks before making any API calls. The index stores atomic chunks of knowledge with keywords and summaries. See "Index: schema, chunking, build, and query" below.
   - **GitHub API:** One tree call, then fetch only needed files. Cache everything under the giterloper cache directory. Rate limits: unauthenticated ~60/hr; with token in `.giterloper/auth` or `GITHUB_TOKEN`, ~5,000/hr.
   - **Shallow clone fallback:** `git clone --depth 1` into `.giterloper/cache/repo/` if bulk access is needed (e.g. building the index, or API budget exhausted).

2. **Operations** (all accept raw string or asset reference for inputs; enables combining stores)

   Each operation should describe **two paths**: the index path (when `.giterloper/cache/index.db` exists) and the fallback path (tree API or clone). Copy the per-operation instructions from the store's INSTRUCTIONS.md and adapt file paths and store details as needed.

   - **answer_from_context:** Query index for chunks matching question keywords; read matched chunks directly; fall back to full file reads only when chunks are insufficient. Cite file paths and chunk headings. No outside knowledge.
   - **retrieve_relevant_context:** Query index for 5-10 relevant chunks across topics; return summaries and excerpts with paths. Fall back to folder-name-based discovery.
   - **verify_claim:** Query index broadly (keywords, synonyms) to find both supporting and contradicting evidence. Check multiple chunks. Report supported / contradicted / not addressed with citations.
   - **add_knowledge:** Place content in appropriate folders; after writing files, **update the index incrementally** — hash the new/modified files, re-chunk them, and insert new rows. Commit.
   - **subtract_knowledge:** Query index to find overlapping chunks; remove overlapping content; **update the index** by deleting removed rows and reindexing modified files. Commit.
   - **intersect_knowledge:** Query index to identify overlapping and non-overlapping chunks; remove non-overlapping content; **update the index**. Commit.

3. **Store-specific details**
   - Config: link or mention `giterloper.yaml` at the store root (name, topic, description).
   - Knowledge root: typically `knowledge/` with self-identifying folder names. Describe the actual layout of the store you're installing from.
   - Constitution: `.giterloper/constitution.md` is a verbatim copy; verify with CONSTITUTION.md5 from the store repo.

4. **Index: schema, chunking, build, and query**

   This section should include all of the following, adapted from the store's INSTRUCTIONS.md. Do not leave this as a vague "optional" section — the index is the primary retrieval mechanism when present.

   - **Prerequisites:** How to detect or install SQLite (Python `sqlite3` module preferred; `sqlite3` CLI as alternative; package manager fallback).
   - **Schema:** The full `CREATE TABLE` and `CREATE INDEX` statements for the `files` and `chunks` tables. Copy from the store's INSTRUCTIONS.md.
   - **Chunking strategy:** How to split knowledge files into atomic chunks (split on headings, merge tiny chunks, split oversized chunks at paragraph boundaries, handle non-markdown files). Copy the rules from the store's INSTRUCTIONS.md.
   - **Build procedure:** Step-by-step: obtain content locally, create/open the DB, walk knowledge files, hash and chunk each file, generate summaries and keywords, insert rows, prune deleted files.
   - **Query procedure:** Example SQL for keyword-based retrieval against the `chunks` table, including how to extract query terms and rank results by match count.
   - **Rebuild triggers:** When to rebuild (missing DB, store updated, empty results for known topics). Full rebuild vs incremental update.

Example opening paragraph: "This project has giterloper installed to access the [Name] knowledge store, which contains knowledge about [topic/description]. The store is at [repo URL]. Perform the six operations (answer_from_context, retrieve_relevant_context, verify_claim, add_knowledge, subtract_knowledge, intersect_knowledge) by following the retrieval strategy below and the operation descriptions. All operations accept raw string or asset reference inputs. Detailed index schema, chunking rules, and query patterns are in the store's own INSTRUCTIONS.md at the repository root."
