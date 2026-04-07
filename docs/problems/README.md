# Giterloper — Ideas & Research

This folder is a living knowledge base for the Giterloper project and the broader problem space it addresses.

## Structure

```
docs/
└── problems/               ← problem definitions and research
    ├── README.md           ← you are here
    ├── intent-drift.md
    ├── review-asymmetry.md
    ├── comprehension-debt.md
    ├── assumption-compounding.md
    ├── sparse-directive-problem.md
    ├── stateless-agent-context.md
    ├── unvetted-knowledge-contamination.md
    ├── parallel-agent-divergence.md
    ├── context-rot.md
    ├── test-inversion.md
    ├── codebase-evolution-blindness.md
    └── agentic-supply-chain-attack.md   ← added Apr 2026
```

### Problem Summaries

| File | One-line Description |
|------|----------------------|
| `intent-drift.md` | Agents gradually deviate from original intent during long-horizon tasks |
| `review-asymmetry.md` | Humans review AI-generated code faster and shallower than they wrote it |
| `comprehension-debt.md` | Engineers lose deep understanding of codebases as AI generates more of it |
| `assumption-compounding.md` | Early wrong assumptions cascade and entrench through subsequent agent turns |
| `sparse-directive-problem.md` | Sparse prompts yield unpredictable variation; dense prompts are brittle — no sweet spot |
| `stateless-agent-context.md` | Each agent session starts fresh, losing accumulated project context across sessions |
| `unvetted-knowledge-contamination.md` | Agent-generated provisional knowledge enters shared knowledge stores as if verified |
| `parallel-agent-divergence.md` | Parallel agents independently build semantically incompatible assumptions |
| `context-rot.md` | Agent context windows go stale mid-task as the codebase changes underneath them |
| `test-inversion.md` | Agents write tests that validate existing behavior rather than intended specification |
| `codebase-evolution-blindness.md` | Agents lack awareness of codebase history, causing solutions to re-introduce fixed bugs |
| `agentic-supply-chain-attack.md` | Agents introduce novel supply-chain attack vectors through hallucinated package names and unaudited dependency chains |

## Philosophy

Each file in `problems/` describes a distinct problem in agentic software development. Files start as definitions and grow via ongoing research — tied to existing literature, named concepts in adjacent fields, and real discussions in the AI tooling community.

When a file gets too long, it becomes a folder. The original content moves into named subtopics underneath it, and sibling files are added for related angles. The goal is a structure that's always navigable and never monolithic.

## What This Is For

- Developing and refining the problem space that Giterloper is built to address
- Building conceptual vocabulary for writing and talking about these problems
- Connecting the ideas to existing academic and practitioner literature
- Finding what's known, what's named, and what's genuinely novel

## Automated Research

An hourly cron job runs research on the content of the `problems/` folder, enriching each file with additional context, cited sources, and connections to adjacent concepts. Files are updated in place; structural changes (folder splits, new sibling files) happen when content warrants it.
