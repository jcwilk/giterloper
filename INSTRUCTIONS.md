# How to use this knowledge store

This repository is a giterloper knowledge store. It contains knowledge about giterloper itself. The file `giterloper.yaml` at the root describes the store's name, topic, and scope. The knowledge lives under `knowledge/` in folders whose names are semantic (e.g. `background/`, `problems_this_solves/`, `how_it_works/`). There is no fixed taxonomy; folder names describe their contents.

You must support six operations. All accept inputs as raw string or asset reference, so you can combine different stores. How you retrieve content depends on where you run and whether a cache exists. Prefer the GitHub API; use a shallow clone only when you need bulk access; use a local index when present.

---

## Retrieval strategy (tiered)

### Check first: local index

If `.giterloper/cache/index.db` exists, use it first. Query it for keywords or file summaries to find relevant paths, then read only those files. This avoids API calls and is the fastest path.

### Primary: GitHub API

This store is hosted on GitHub. Prefer the REST API so you do not pull repo history (knowledge stores can have long histories of edits).

**Rate limits:**

- **Unauthenticated:** ~60 requests per hour per IP. Plan carefully: e.g. one tree call plus a few file reads per session.
- **Authenticated:** ~5,000 requests per hour. If the user has configured a token (e.g. in `.giterloper/auth` or `GITHUB_TOKEN`), use it. If not, during setup you may ask whether to store a token in `.giterloper/auth` (gitignored); if they decline, use unauthenticated access and cache aggressively.

**Procedure:**

1. Get the default branch or the ref you need (e.g. `GET /repos/{owner}/{repo}` for `default_branch`, or use `main`).
2. Get the tree: `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`. One call gives the full directory structure.
3. Use folder names under `knowledge/` to decide which paths are relevant (folder names are semantic).
4. Fetch only the files you need via `GET /repos/{owner}/{repo}/contents/{path}` (or the Git blobs API if you prefer).
5. Write any fetched content into `.giterloper/cache/` (e.g. by path) so later operations can read from cache instead of calling the API again. `.giterloper/cache/` is gitignored.

If you get 403 with rate-limit headers, stop until the reset time or switch to the shallow-clone fallback.

### Fallback: shallow git clone

If you have `git` available and need more than the API budget allows (e.g. bulk indexing, or many files in one session):

1. Clone into a **cache directory**, not the working tree: `git clone --depth 1 <repo_url> .giterloper/cache/repo/`. `.giterloper/cache/` is gitignored.
2. All further reads are local; no API cost.
3. To refresh later: `git -C .giterloper/cache/repo fetch --depth 1 origin main` (or the default branch), then checkout as needed.

Use `--depth 1` to avoid pulling long history. Knowledge stores often have many small commits.

### Git submodules (optional, not default)

Users can add this store as a submodule to pin a folder to a specific commit. Submodules are not recommended by default: `git submodule update` fetches history, and shallow submodules are not well supported everywhere. Mention submodules as an option for users who want tight coupling; do not recommend them as the primary access method.

---

## Operations

### answer_from_context

Answer the user's question using **only** information from the scoped context. Accepts the question as a raw string; scope may be an asset reference (default: this store). Do not add outside knowledge or assumptions. Ground every claim in the retrieved content.

1. Resolve scope: if an asset reference is given, fetch that content; otherwise use this store.
2. Read `giterloper.yaml` to understand scope.
3. If `.giterloper/cache/index.db` exists, query it to find relevant files; otherwise use the tree API (or local clone) to list folders and pick by name.
4. Read only the files in relevant folders.
5. Compose an answer from that content only. Cite paths or snippets.

### retrieve_relevant_context

Retrieve and summarize the most relevant parts of the scoped context for a given query. Accepts the query as a raw string; scope may be an asset reference (default: this store).

1. Resolve scope as above; same discovery: config, then index or tree + folder names.
2. Read the most relevant files; optionally read a few more if the query spans topics.
3. Return a concise summary and/or key excerpts, with paths. Stay within API budget if unauthenticated (prefer cache and few file reads).

### verify_claim

Say whether a claim is **supported**, **contradicted**, or **not addressed** by the scoped context. Accepts the claim as a raw string; scope may be an asset reference (default: this store).

1. Same discovery: find the most relevant folders and files.
2. Check multiple relevant areas, not just the first match.
3. If the context says nothing about the claim, report "not addressed". Only say "supported" or "contradicted" when the content clearly does so.

### add_knowledge

Add new knowledge and reconcile it with the existing store. Accepts the knowledge as a raw string or an asset reference (e.g. to another store).

1. If an asset reference: fetch the content from that store/path first.
2. Scan existing `knowledge/` folder names for topical overlap.
3. Place content in the best-fitting folder(s). If none fit, create a new folder with an underscore-separated name (e.g. `new_topic_area`).
4. Consider whether the structure should change: merge folders, split one, or rename for clarity. Do so if it improves coherence.
5. If `.giterloper/cache/index.db` exists, update it (new rows for new/updated files, keywords, summaries).
6. Commit with a clear message. Requires write access (local clone with push, or PR via API).

### subtract_knowledge

Remove from this store all knowledge that overlaps with the passed knowledge. Accepts the knowledge as a raw string or an asset reference.

1. If an asset reference: fetch the content from that store/path.
2. Compare with this store's content; identify overlapping items (by topic, semantics, or structure).
3. Remove overlapping content; keep the rest. Adjust folder structure if folders become empty.
4. Update index if present; commit with a clear message.

### intersect_knowledge

Remove from this store all knowledge that does **not** overlap with the passed knowledge. Accepts the knowledge as a raw string or an asset reference.

1. If an asset reference: fetch the content from that store/path.
2. Compare with this store's content; identify overlapping items.
3. Keep only overlapping content; remove everything else. Merge or consolidate folders as needed.
4. Update index if present; commit with a clear message.

---

## Index and cache

- **Location:** `.giterloper/cache/` (gitignored). Typical contents: `index.db` (SQLite), maybe `repo/` for a shallow clone, and any API-fetched file dumps.
- **Building the index:** From the knowledge store contents (e.g. after clone or API tree + file fetch), build a SQLite DB with at least: path, optional keywords, short summary or first paragraph, optional content hash. Design so most `retrieve_relevant_context` queries can be satisfied with index lookups plus 1–2 file reads when unauthenticated.
- **Rebuild:** If the cache is stale or missing, re-fetch (API or clone), then rebuild the index from current `knowledge/` content. Document the rebuild steps in your tooling or in a short "Rebuild index" section here if needed.

---

## This repository specifically

- **Config:** `giterloper.yaml` at root (`name`, `topic`, `description`, `repo_url`, `constitution_version`).
- **Knowledge root:** `knowledge/`. Subfolders are self-identifying (e.g. `background/`, `problems_this_solves/`, `how_it_works/`). No fixed schema; add or rename folders as the store evolves.
- **Constitution:** A verbatim copy lives in `.giterloper/constitution.md`. Do not edit it; verify with root `CONSTITUTION.md5` if needed.
