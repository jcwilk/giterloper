# Product context and use cases

**Preamble:** This file lives under **`docs/`** as **descriptive vision**—what we are building toward and why it matters—not as a lock on product behavior. **Normative** contracts (what the software **must** do) are only under **`specs/*`** and tests; if this narrative ever disagrees with those layers, **trust `specs/` and align `docs/`**.

---

This document is **descriptive** background: it explains what Giterloper is for and how external agents typically use it. It is **not** a substitute for executable contracts in **[`specs/core.md`](../specs/core.md)**, **[`specs/pin-semantics.md`](../specs/pin-semantics.md)**, **[`specs/cli.md`](../specs/cli.md)**, or **[`specs/MCP.md`](../specs/MCP.md)**—those files define normative behavior paired with tests. For **pin naming, session pin rules, branch/ref resolution, and MCP tool contracts**, follow those area specs.

---

## What Giterloper is

Giterloper is a **knowledge management server** that exposes a **Model Context Protocol (MCP)** interface. It connects to a **Git repository** that holds the knowledge store and provides tools for retrieving, searching, and integrating knowledge on behalf of **external agents**. Knowledge is stored as **Markdown** (the format may evolve, but Markdown fits agent-produced, human-readable, versioned content well).

Giterloper does **not** generate or discover knowledge by itself; it **manages** what external agents push into the store and how that material is queried and reconciled. Agents interact through MCP; they do not need to depend on internal indexing, caching, or reconciliation details.

---

## Three entities

1. **The Giterloper codebase** (this repository) — application code that runs as a server (often private), exposes MCP, and manages the knowledge store: serving queries, accepting new knowledge, and reconciling incoming material with existing content. It acts as an **abstraction layer** so agent integrations can stay stable as internals evolve.

2. **The knowledge store** — a **separate** Git repository (often private) whose files hold accumulated knowledge. Giterloper is the component that reads and writes that repo on behalf of agents. Keeping the store separate from application code allows public code with private knowledge, and keeps **commit history** focused: code changes versus knowledge evolution are not interleaved.

3. **External agents** — any MCP-capable client that consumes knowledge (querying what is known) and produces knowledge (pushing new findings for integration). A “continuous research engine” is one example; any other MCP agent can play the same role.

### Why separate repositories for code and knowledge?

Coupling knowledge with application code makes it hard to ship or share one without the other, and produces a **mixed history** (features versus domain research) that is difficult to navigate. Knowledge content is usually **about the user’s domain**, not about Giterloper itself.

Knowledge and code also differ in how **version history** is used: reverting or comparing **knowledge** over time is common; rolling back **released application** code is rarer outside active development. Separate repos let each evolve at its own pace.

### Version-specific knowledge and pins

Queries run against a **specific version** of the knowledge store (a commit). The product may default to a branch head for convenience; callers can also target a **specific SHA** for stability and reproducibility. The **normative** rules for pins, session defaults, and ref/branch handling are in **[`specs/pin-semantics.md`](../specs/pin-semantics.md)** and **[`specs/MCP.md`](../specs/MCP.md)**.

Motivation (non-normative):

- **Session consistency** — multi-step agent workflows may need a stable snapshot while reading, deciding, and writing; pinning reduces surprise from concurrent writers.
- **Before-and-after** — after integrating new material, the store may be reorganized; comparing **state identifiers** (commit SHAs) reflects the full effect of integration, not only new files.
- **Reproducibility** — results can be tied to an exact knowledge version for audit and debugging.

---

## Use case 1: Continuous research engine

**Problem:** Capable agents can research topics, but findings often live only in a **session** and are lost when the session ends. There is no shared, queryable memory across sessions unless operators manually copy content into files—and the agent still cannot query that archive through a standard tool interface.

Databases lack the same **versioning and rollback** affordances as Git for knowledge-shaped content. Note-taking tools target humans. Raw Git repos lack **search, indexing, and MCP-shaped APIs** that agents expect.

**Pattern:** An external “research engine” uses Giterloper as its MCP backend. The engine does outward-facing work (sources, synthesis); Giterloper does inward-facing work (store, organize, search, serve).

Typical loop:

1. Query Giterloper for current knowledge on a topic.
2. Identify gaps (missing, stale, or thin coverage).
3. Gather new information (web, documents, etc.—**outside** Giterloper).
4. Push new Markdown via MCP; Giterloper integrates it and returns a new **state** (commit SHA).
5. Compare previous and new state to understand integration effects; continue from the new state.

**Boundaries:** Giterloper does **not** search the public internet or decide what to research; that intelligence stays in the external agent. Giterloper stays a **knowledge backend**, not a research agent.

---

## Use case 2: Embedded knowledge for any repository

**Problem:** Teams accumulate **shared knowledge** (research, conventions, ADRs, runbooks) and want many projects and agents to use it **without** copying files (stale copies), **without** heavy submodule workflows, and **without** merging unrelated concerns into one repository (see above).

Even with files in hand, each consumer would need its own **search and retrieval** stack duplicating effort everywhere.

**Pattern:** Giterloper is a **central knowledge server**: it manages the store and exposes content through MCP. Agents in **any** repository can query Giterloper without direct Git access to the store and without reimplementing search.

Benefits (conceptual):

- **Centralized indexing and search** — one implementation, many consumers.
- **Access control** — mediation through the server (authentication, read vs write, policy); the raw store can remain private.
- **Version-pinned queries** — consumers can pin to a known-good snapshot while others advance the live store; see area specs for how pinning is expressed.

Examples of knowledge suited to this model: agent skill files, shared conventions, research syntheses, design “as-is” vs “to-be” artifacts, operational runbooks.

---

## How the use cases fit together

These scenarios are two directions of the same flow:

- **Research / intake** — agents produce knowledge and push it **into** the store through Giterloper.
- **Embedded / distribution** — agents **pull** curated knowledge from the store through Giterloper.

Knowledge produced in one context can be consumed in another: different agents need not know about each other, and neither needs to depend on Giterloper’s internal storage layout. Giterloper sits in the middle—**storage, versioning, indexing, and retrieval**—so agents can focus on research, coding, or operations.
