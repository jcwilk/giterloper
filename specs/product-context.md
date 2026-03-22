# Product context and use cases

This document is **explanatory**—motivation, architecture, and representative workflows. It is **not** a normative contract. **MUST**-level behavior lives in the area specs: **[specs/core.md](./core.md)** (pins, session layout, shared semantics), **[specs/cli.md](./cli.md)** (CLI), and **[specs/MCP.md](./MCP.md)** (MCP transport, tools, errors). Where this text mentions versioning, pins, or search isolation, those details are defined there.

---

Giterloper is a knowledge management server that exposes an MCP interface. It connects to a private Git repository—the **knowledge store**—and provides tools for retrieving, searching, and integrating new knowledge on behalf of external agents. Knowledge is stored as Markdown files (the format may evolve; Markdown suits agent-produced, human-readable, git-tracked content). Giterloper does not generate or discover knowledge on its own; it manages what gets pushed to it by external agents.

## Architecture

There are three main entities:

1. **The Giterloper repo** (application codebase)—runs as a server, exposes MCP, and manages the knowledge store: serving queries, accepting new knowledge, and reconciling incoming material with what already exists. Giterloper is an abstraction layer—agents interact through MCP without needing to know how indexing, caching, or reconciliation work internally.
2. **The knowledge store**—a private Git repository whose Markdown files hold accumulated knowledge. Giterloper is the component that reads from and writes to this repo (subject to deployment and auth). Keeping the store separate from the application repo lets code stay public while knowledge stays private, and keeps commit histories focused (code changes vs knowledge evolution).
3. **External agents**—any agent or system that connects via MCP. They consume knowledge (what is known about a topic) and produce knowledge (new findings for integration). A continuous research engine is one example; any MCP-capable agent can play this role.

### Why separate repos?

Combining application code and knowledge in one repository couples unrelated concerns: shipping code drags knowledge along, sharing knowledge drags code along, and history interleaves two different kinds of work. Knowledge content is usually about a domain, not about Giterloper itself.

Version history also differs: rolling back or comparing **knowledge** states is common; rolling back **application** code outside active development is less so. Separate repositories let each evolve on its own schedule.

### Version-specific knowledge

Queries run against a **particular commit** of the knowledge store. The product may default to a branch head for convenience; agents can **pin** to a specific SHA for consistency and reproducibility. Normative pin and session rules: **[Pin configuration semantics](./core.md#pin-configuration-semantics)** and **[specs/MCP.md](./MCP.md)** (tools, session layout). Search/index usage is **isolated per pin and SHA**—see **Search index isolation** in `specs/MCP.md`.

Motivations for pinning include:

- **Session consistency**—multi-step workflows can keep a stable knowledge snapshot while other agents push concurrently.
- **Before-and-after comparison**—after integration, a new commit SHA represents the updated state; agents can compare states when reconciliation reorganizes content, not only when files are appended.
- **Reproducibility**—results can be tied to an exact knowledge version.

---

## 1. Continuous research engine

### The problem

Capable agents can research topics, but findings often die with the session. There is no shared, queryable memory across sessions unless operators manually file outputs. Databases lack git-style history and rollback; note-taking tools are human-centric; raw Git lacks search and a standard agent API.

### How Giterloper fits

A **continuous research engine** is an external agent that uses Giterloper as its MCP backend to accumulate knowledge over time. The engine does outward-facing work (sources, synthesis); Giterloper does inward-facing work (store, organize, search, serve).

Typical loop:

1. Query Giterloper for current knowledge on a topic.
2. Identify gaps (missing, outdated, or thin coverage).
3. Gather new information (web, documents, etc.—outside Giterloper).
4. Push new Markdown via MCP (`insert_pending`, reconciliation flow as defined in specs).
5. Giterloper integrates material and returns updated state (commit SHA).
6. Compare previous and new SHAs to understand effects of integration; continue from the new state.

**Why this works:** Giterloper surfaces what is already known; internals can improve without MCP contract churn for research engines. Intake is git-backed and versioned. **Giterloper does not search the web**—research strategy stays in the external agent; Giterloper stays a knowledge backend.

---

## 2. Embedded knowledge for any repository

### The problem

Teams want one body of knowledge (research, conventions, ADRs) available to agents in **many** projects. Copying files goes stale; submodules add friction; monorepos recreate the coupling problems above. Even with files in place, each consumer would re-implement search and retrieval.

### How Giterloper fits

Giterloper acts as a **centralized knowledge server**: MCP clients query without cloning the store or building their own index. Access control can be enforced at the server; the store can remain private. Agents can **pin** to a known-good SHA for stable builds, then move forward when ready—see area specs for pin and branch rules.

**Examples of knowledge worth centralizing:** agent skills and prompts, shared coding conventions, research syntheses, design “as-built” vs “to-be” narratives, operational runbooks.

---

## How the use cases combine

- **Continuous research** emphasizes **intake**—agents pushing knowledge through Giterloper into the store.
- **Embedded knowledge** emphasizes **distribution**—agents in other repos pulling knowledge through MCP.

Together they describe a cycle: external agents produce knowledge, Giterloper integrates it into a git-backed store, and other agents consume it—without requiring pairwise awareness or knowledge of internal storage layout.
