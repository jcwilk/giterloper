# Giterloper Constitution

**Version:** 1.1.0  
**Semantic versioning:** Same major.minor.patch means byte-identical content. Verify with CONSTITUTION.md5.

---

## 1. Core dependency: Git

Giterloper knowledge stores are Git repositories. The paradigm depends on Git for:

- Versioning and history
- Branching and merging
- Distributed replication
- No abstraction over Git: giterloper assumes Git. Other VCS are out of scope.

---

## 2. Required operations

Every knowledge store MUST provide instructions (at or near the root of the repository) that explain how an agent performs the following operations on that store. The instructions are store-specific; the operations are universal.

**Operation inputs:** All operations accept inputs as either a raw string or an asset reference. This enables combining different stores: you can pass a reference to another store or a path within it, and the agent fetches the content (or scopes the operation) accordingly. A raw string supplies the content directly.

### answer_from_context

Answer a question using only information contained in the scoped knowledge context. Use for grounded, authoritative answers without adding outside knowledge or assumptions. Accepts the question as a raw string; the scope may be specified as an asset reference (default: this store).

### retrieve_relevant_context

Retrieve and summarize the most relevant information from the scoped knowledge context for a given query. Use when you need background or source material before reasoning or answering. Accepts the query as a raw string; the scope may be specified as an asset reference (default: this store).

### verify_claim

Evaluate whether a claim is supported, contradicted, or not addressed by the scoped knowledge context. Use for fact-checking or validation. Accepts the claim as a raw string; the scope may be specified as an asset reference (default: this store).

### add_knowledge

Add new knowledge to the store and reconcile it as it is added. Accepts the knowledge as a raw string or an asset reference (e.g. to another store or a path within it). Includes:

- Placing new content in the appropriate location(s)
- Evaluating whether the folder structure should change (more folders, fewer folders, renames)
- Integrating with existing content so the store remains coherent

### subtract_knowledge

Remove from this store all knowledge that overlaps with the passed knowledge. Accepts the knowledge as a raw string or an asset reference. Overlapping content (by topic, semantics, or as defined by the store's instructions) is removed; the rest is kept.

### intersect_knowledge

Remove from this store all knowledge that does *not* overlap with the passed knowledge. Accepts the knowledge as a raw string or an asset reference. Only content that overlaps with the passed knowledge is kept; everything else is removed. Use to narrow a store to a subset defined by another store or asset.

---

## 3. Instructions requirement

Every knowledge store must have instructions (in a file at or near the root, e.g. INSTRUCTIONS.md) that explain, for that store's structure:

- How to perform each of the six operations above
- How to discover and navigate the knowledge (folder layout, indexing, retrieval method)
- Any store-specific conventions (e.g. GitHub API, local clone, cache location)

The structure of the knowledge is arbitrary; the instructions are the contract. Change structure freely as long as the instructions are updated to match.

---

## 4. Constitution integrity

- The constitution file (this file) resides in the knowledge store repository. When a target connects by cloning the store, the constitution is available in the clone. No edits.
- Agents MAY verify it by comparing its MD5 checksum to CONSTITUTION.md5 from the canonical repository.
- To change the constitution: publish a new version (new semver, new content). Do not edit in place. Installations pin to a constitution version (e.g. 1.0.0).

---

## 5. Asset reference scheme

Knowledge assets may be referenced with a URI-like string:

```
[source@]ref[::path]
```

- **source** (optional): origin of the store (e.g. `github.com/owner/repo`). Omit when referring to the current repository.
- **ref** (optional): Git ref — SHA, branch name, tag, or semantic version. Ref can contain slashes (e.g. `feature/topic`).
- **path** (optional): path within the knowledge store at that ref. Separator between ref and path is `::` so that slashes in refs do not collide with path segments.

**Examples:**

| Form | Meaning |
|------|--------|
| `github.com/owner/repo@main::knowledge/background` | Full: that repo, branch main, path knowledge/background |
| `@v1.0.0::how_it_works` | Same repo, tag v1.0.0, path how_it_works |
| `@main` | Same repo, whole store at main |
| `::knowledge/problems_this_solves` | Current ref, path only |

Interpretation of the path is defined by the target store's instructions.
