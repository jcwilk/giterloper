## Instructions template

The INSTRUCTIONS.md you create for the project should cover the following. Adapt to the actual knowledge store URL and structure. The source knowledge store's own INSTRUCTIONS.md (at the store root) is the reference implementation — consult it for QMD setup, search patterns, and per-operation usage.

1. **Access**
   - Content is accessed via a depth=1 clone at `.giterloper/repos/<ref>/` (default ref: `main`).
   - QMD indexes the `knowledge/` directory for search. Each version gets its own QMD collection named `<store>@<ref>`.
   - No API calls; clone and QMD only. See "QMD: setup, search, and maintenance" below.

2. **Operations** (all accept raw string or asset reference for inputs; enables combining stores)

   Each operation should describe **two paths**: the QMD path (when QMD collection exists) and the direct-read path (from the clone). Copy the per-operation instructions from the store's INSTRUCTIONS.md and adapt paths and store details as needed.

   - **answer_from_context:** Use `qmd search`/`qmd query` for chunks matching the question; `qmd get` for full files when needed. Fall back to reading files from the clone. Cite file paths and headings. No outside knowledge.
   - **retrieve_relevant_context:** Use `qmd search`/`qmd query` for 5-10 relevant chunks; return summaries and excerpts with paths. Fall back to folder-name-based file reads.
   - **verify_claim:** Use `qmd search`/`qmd query` broadly (keywords, synonyms) to find supporting and contradicting evidence. Check multiple results. Report supported / contradicted / not addressed with citations.
   - **add_knowledge:** Place content in appropriate folders; run `qmd update` after writing files. When combining with another version: clone that version, add its QMD collection, search both independently. Commit.
   - **subtract_knowledge:** Use `qmd search` to find overlapping chunks; remove overlapping content; run `qmd update`. Commit.
   - **intersect_knowledge:** Use `qmd search` to identify overlapping vs non-overlapping chunks; remove non-overlapping content; run `qmd update`. Commit.

3. **Store-specific details**
   - Config: link or mention `giterloper.yaml` at the store root (name, topic, description).
   - Knowledge root: typically `knowledge/` with self-identifying folder names. Describe the actual layout of the store you're installing from.
   - Constitution: `.giterloper/constitution.md` is a verbatim copy; verify with CONSTITUTION.md5 from the store repo.

4. **QMD: setup, search, and maintenance**

   This section should include, adapted from the store's INSTRUCTIONS.md:

   - **Prerequisites:** git, Node.js >= 22 or Bun >= 1.0, QMD (`npm install -g @tobilu/qmd`).
   - **Collection setup:** `qmd collection add .giterloper/repos/<ref>/knowledge --name <store>@<ref> --mask "**/*.md"`. Add context with `qmd context add qmd://<store>@<ref> "<description>"`.
   - **Search modes:** `qmd search` (keyword, fast, no models), `qmd query` (hybrid, best quality, needs embeddings), `qmd vsearch` (semantic only), `qmd get` (retrieve by path).
   - **Multi-version:** When combining operations need two versions, clone the second ref into `.giterloper/repos/<ref>/`, add its QMD collection, search each with `-c <store>@<ref>`.
   - **Maintenance:** `qmd update` to re-index after changes; `qmd update --pull` to pull upstream and re-index.

Example opening paragraph: "This project has giterloper installed to access the [Name] knowledge store, which contains knowledge about [topic/description]. The store is at [repo URL]. Perform the six operations (answer_from_context, retrieve_relevant_context, verify_claim, add_knowledge, subtract_knowledge, intersect_knowledge) by following the access and search guidance below. All operations accept raw string or asset reference inputs. Detailed QMD setup and search patterns are in the store's own INSTRUCTIONS.md at the repository root."
