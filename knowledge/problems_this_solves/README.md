# Problems this solves

This folder holds knowledge about the pain points giterloper addresses.

- **Long-term incremental source of truth:** Many systems need a durable, versioned store that can be the bottom layer for aggregates, dashboards, or other views. Giterloper uses Git as that store.
- **Structure-agnostic knowledge:** The structure of the knowledge can change over time; instructions at the root define how to read and write it, so agents and tools adapt without a fixed schema.
- **Portability between stores:** Two different knowledge stores (or two versions of the same store) can use different structures. As long as each has instructions for extraction and ingestion, an agent can translate between them by following those instructions.
- **Agent-friendly access:** Operations are defined in terms of what an agent needs: answer from context, retrieve relevant context, verify claims, ingest knowledge. No need to hand-roll CRUD over an ad-hoc layout.
