# Giterloper Constitution

Contract between the Giterloper client and knowledge stores (e.g. giterloper_knowledge). Defines the minimal conventions both need for new-knowledge intake from Giterloper to the knowledge store.

---

## 1. Layout

Paths are relative to the **knowledge store repository** root (not the Giterloper repo). Giterloper gains access to these paths by operating on a clone of the knowledge store.

- `**/knowledge`** — All knowledge lives at this path. The knowledge store owns this directory and its structure.
- `**/knowledge/_pending**` — Drop zone for new knowledge from the Giterloper client. The store accepts this folder; Giterloper MAY create it if missing.

---

## 2. Pending assets

- Giterloper writes titled Markdown files into `/knowledge/_pending` with arbitrary/random filenames.
- **Order:** Filename order is undefined. The source of truth for ordering is **commit history**: earlier commits = earlier in order. Assets added in the same commit are tied; the store may order them arbitrarily among themselves.
- The knowledge store (or its agents) processes these assets and integrates them into the canonical knowledge. What happens after integration (e.g. deletion, archiving) is store-specific.

---

## 3. Summary


| Party               | Responsibility                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Knowledge store** | Expose `/knowledge`, accept or allow `/knowledge/_pending`, process assets by commit order.                 |
| **Giterloper**      | Write titled Markdown files into `/knowledge/_pending`, use opaque filenames, rely on commits for ordering. |
