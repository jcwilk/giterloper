# Giterloper Use Cases

Giterloper is a knowledge management server that exposes an MCP interface. Giterloper connects to a private Git repository — the "knowledge store" — and provides tools for retrieving, searching, and integrating new knowledge on behalf of external agents. All knowledge is stored as Markdown files (this may evolve in the future, but Markdown is an excellent format for agent-produced, human-readable, git-tracked knowledge). Giterloper does not generate or discover knowledge on its own; Giterloper strictly manages what gets pushed to it by external agents.

## Architecture

There are three main entities:

1. **The Giterloper repo** (this repository) — a public codebase that runs as a presumably private server. Giterloper exposes an MCP interface that other agents connect to. Giterloper's job is to manage the knowledge store: serving queries, accepting new knowledge, and reconciling incoming material with what already exists. Giterloper acts as an abstraction layer — external agents don't need to know how indexing, caching, or reconciliation work internally. Agents only need to know that they can push knowledge in and query knowledge out. This lets Giterloper's internals improve over time without requiring changes to any agent that consumes the MCP interface.
2. **The knowledge store** — a private GitHub repository containing Markdown files that represent the accumulated knowledge. Giterloper is the only entity that reads from and writes to this repo. Keeping the knowledge store separate from the Giterloper codebase means the application code can be public while the knowledge remains private. Commits to each repo represent a single concern: code changes in one, knowledge evolution in the other.
3. **External agents** — any agent or system that connects to Giterloper via the MCP interface. External agents consume knowledge (asking Giterloper what's currently known about a topic) and produce knowledge (pushing new findings to Giterloper for integration). The continuous research engine described below is one example, but any MCP-capable agent can play this role.

### Why separate repos?

Storing knowledge in the same repository as the application code creates awkward coupling. You can't ship the code without the knowledge tagging along. You can't share or move the knowledge without dragging the code with it. And the commit history becomes a confusing interleave of two completely unrelated concerns — feature work on Giterloper versus, say, research notes on some unrelated domain. The knowledge store is generally not about Giterloper at all; the knowledge store is about whatever you happen to be researching.

The separation also reflects different usage patterns around version history. Rolling back to an earlier knowledge state is a common and expected operation — you might want to compare what was known last week to what's known now, or freeze the knowledge at a specific point for consistency. Rolling back to an earlier code state, on the other hand, is unusual outside of active development. These two histories have fundamentally different lifecycles and access patterns, which makes combining them in one repo a poor fit.

Separating them lets each move at its own pace for its own reasons.

### Version-specific knowledge

The knowledge store is always specific to a version. Every query against Giterloper runs against a particular commit of the knowledge store. Giterloper can default to a branch head for convenience, but agents can also pin queries to a specific commit SHA. This is important for several reasons:

- **Consistency during a session.** When an external agent is working through a multi-step process — reading knowledge, making decisions based on what's known, pushing new material — the agent may need the knowledge to stay stable between queries. Pinning to a specific version guarantees that the knowledge won't shift mid-session due to other agents pushing new material concurrently.
- **Before-and-after comparison.** When an agent pushes new knowledge, Giterloper responds with a new state ID (commit SHA). That new state may differ significantly from the previous one — Giterloper may restructure, rebalance, or reorganize the store as part of reconciliation. The agent can compare the old and new state IDs to understand the effects of the new knowledge, not just that new files were added.
- **Reproducibility.** Any result that Giterloper returns can be tied to an exact knowledge version. If an agent makes a decision based on a query, the version provides a permanent record of what knowledge informed that decision.

---

## 1. Continuous Research Engine

### The problem

AI agents are increasingly capable of researching topics — reading documentation, searching the web, synthesizing information from multiple sources. But the knowledge they produce is ephemeral. Findings live in a chat transcript or a session context, and when the session ends, the knowledge is effectively gone. Starting a new session means starting from scratch. The agent has no memory of what previous sessions already discovered, no way to ask "what do I already know about this?", and no way to build on prior work.

You could save the outputs manually — copy the agent's findings into files, organize them yourself — but that doesn't scale, and the agent still can't query its own prior knowledge in future sessions. What's missing is a persistent, structured, queryable knowledge base that the agent can both read from and write to, one that accumulates knowledge across sessions and makes that knowledge available to future research.

Existing tools don't fill this gap well. Databases provide persistence but not version history, branching, or the ability to roll back to earlier states of knowledge. Note-taking apps are designed for humans, not agents. Raw Git repositories provide versioning but not search, indexing, or an API that an agent can consume through standard tool interfaces.

### How Giterloper solves this

A continuous research engine is an external agent that uses Giterloper as its MCP backend to build up a body of knowledge over time. The research engine is responsible for the outward-facing work: reading sources, searching the internet, synthesizing information. Giterloper is responsible for the inward-facing work: storing, organizing, searching, and serving that knowledge.

The cycle looks like this:

1. The research engine queries Giterloper for the current state of knowledge on a topic.
2. The research engine identifies gaps — things that are missing, outdated, or insufficiently covered.
3. The research engine goes and finds new information (web searches, document analysis, whatever the engine's capabilities allow).
4. The research engine pushes the new Markdown files to Giterloper.
5. Giterloper integrates the new material into the knowledge store — which may involve restructuring or reorganizing existing knowledge — and responds with a new state ID (a commit SHA from the underlying Git repository).
6. The research engine can compare the previous state ID to the new one to understand the full effects of the integration, then continue from the new state in the next iteration.

**What makes this work well:**

- **Giterloper knows what's already known.** When the research engine asks what exists on a topic, Giterloper can search and retrieve from the full knowledge store. This lets the research engine avoid re-discovering things and focus effort on genuine gaps.
- **Giterloper is an abstraction layer.** The research engine doesn't need to know how Giterloper indexes knowledge, manages caches, or reconciles new material with existing material. The research engine only needs two capabilities: push new knowledge in, and query existing knowledge out. This means Giterloper's internals can be improved — better indexing, smarter reconciliation, new storage strategies — without requiring any changes to the research engine or any other external agent.
- **Append-only intake.** New knowledge pushed to Giterloper gets committed to Git as Markdown files. Every piece of information is versioned, attributable, and recoverable. If the research engine pushes low-quality material, nothing is lost — the knowledge store can always be rolled back, reorganized, or selectively pruned. The non-destructive nature of Git as a storage layer means the research engine can run freely.
- **State IDs make resumption and comparison trivial.** Each integration produces a new commit SHA. The research engine can use this as a checkpoint to resume later, but the state ID is more than a bookmark — because Giterloper may restructure the store during integration, comparing the old and new states reveals the full impact of the new knowledge, not just what was appended. When a new session starts, the research engine picks up from the last known state. Research compounds over time instead of resetting.
- **Giterloper doesn't search the internet.** This is a deliberate boundary. Giterloper only manages knowledge that gets pushed to Giterloper by external agents. The intelligence about what to research and how to find information lives in the external agent. This keeps Giterloper focused and composable — Giterloper is a knowledge backend, not a research agent.

The end result is a loop: the research engine reads the current state of knowledge via Giterloper's MCP interface, identifies what's missing, does the research, and feeds findings back to Giterloper as Markdown files. Over time, the knowledge store grows into a structured, git-backed body of knowledge on whatever topics you point agents at.

---

## 2. Embedded Knowledge for Any Repository

### The problem

Suppose you've built up a body of knowledge — research findings on a technology, design documents for a system, coding conventions your team follows — and now you need agents working in other projects to have access to that knowledge. Today the options are unsatisfying.

You could copy the relevant files into each project, but the copies go stale the moment the source changes. You could use Git submodules, but submodules are notoriously painful to manage and add friction to every clone and checkout. You could put everything — code and knowledge — in one repository, but that couples unrelated concerns and creates the problems described in the architecture section above.

Even if you solve the distribution problem, there's a deeper issue: every project that consumes the knowledge needs its own machinery to search and parse it. If the knowledge is a collection of Markdown files, each consuming agent or project needs to implement its own indexing, its own search, its own way of answering "what does the knowledge base say about X?". That's redundant work, and it means improvements to search or indexing have to be replicated everywhere.

### How Giterloper solves this

Giterloper eliminates both problems — distribution and search — by acting as a centralized knowledge server. Since Giterloper manages the knowledge store and exposes the knowledge via MCP, any agent working in any repository can query Giterloper for relevant knowledge without needing direct access to the knowledge store repo or implementing any search logic.

**What Giterloper provides as a distribution layer:**

- **Centralized indexing and search.** Giterloper handles all the machinery needed to index and search through the knowledge store. Without Giterloper, every consuming agent or project would need to re-implement search, parsing, and retrieval against the raw Markdown files. Giterloper does this once, and every connected agent benefits.
- **Access control.** Because all access goes through Giterloper's MCP interface, Giterloper can enforce whatever authentication and authorization model makes sense — per-agent permissions, read-only vs. read-write access, topic-scoped visibility. The knowledge store itself stays private; Giterloper decides what each agent is allowed to see and do.
- **Version-pinned queries.** Agents can request knowledge at a specific version. An agent building software can pin to a known-good knowledge state and work against that stable snapshot, even while other agents are actively pushing new material to the store. When the agent is ready to incorporate newer knowledge, the agent explicitly moves to a newer version.

**Examples of knowledge worth embedding:**

- **Agent skill files** — system prompts, instruction sets, and behavioral guidelines maintained in the knowledge store but needed across many projects.
- **Shared conventions** — coding standards, review checklists, or architectural decision records that apply to multiple repositories.
- **Research findings** — synthesized information about a domain, technology, or problem space that agents in multiple projects need to reference.
- **System design knowledge** — both how a system currently works and how the system should work, tracked as separate knowledge artifacts. Giterloper can serve both, and an agent can compare the two to gauge progress, identify remaining work, and decide what to build next — without that information needing to be structured into tickets or task trackers.
- **Operational runbooks** — incident response procedures, deployment guides, or onboarding docs maintained centrally.

The key advantage is that Giterloper mediates all access. Consuming agents don't need direct Git access to the knowledge store, don't need to implement their own search, and don't need to manage their own caches or indexes. Agents talk to Giterloper's MCP interface, and Giterloper handles the rest.

---

## How They Fit Together

These two use cases describe opposite directions of the same flow, both mediated by Giterloper's MCP interface.

The research engine use case is about **intake** — external agents pushing new knowledge into the store through Giterloper. The embedded knowledge use case is about **distribution** — external agents pulling curated knowledge from the store through Giterloper.

Together, these use cases describe a cycle: knowledge gets produced by external agents, integrated into a private git-backed store by Giterloper, and then served out to the projects and agents that need the knowledge. A research engine might push new findings about a technology, and an agent building software in a completely different repository might query Giterloper for those findings the next day — without either agent knowing about the other, and without either needing to understand how Giterloper stores or organizes the knowledge internally.

The use cases also build on each other. The more knowledge the research engine feeds into Giterloper, the more useful the embedded knowledge use case becomes. And as more agents consume knowledge through Giterloper, the gaps they surface (even implicitly, through the kinds of queries they make) can inform what the research engine investigates next. Giterloper sits in the middle, handling storage, versioning, indexing, and retrieval — so that external agents can focus on what they're good at, whether that's researching new topics or building software.
