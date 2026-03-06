# How it works

This folder holds knowledge about the mechanics of giterloper.

- **Constitution:** An immutable (per-version) document defines the paradigm: Git dependency, six required operations, asset reference scheme. It is copied verbatim into installed projects and verified via MD5.
- **Instructions:** Each knowledge store has an INSTRUCTIONS.md (or equivalent) that explains how to perform the six operations on that store's structure. All operations accept raw string or asset reference inputs. Structure is arbitrary; the instructions are the contract. INSTRUCTIONS.md contains QMD setup, search patterns, and per-operation usage.
- **Bootstrap:** Installing giterloper into a project means adding a `.giterloper/` directory (or project-equivalent), copying the constitution, ensuring prerequisites (git, Node.js/Bun, QMD), cloning the store, setting up the QMD collection, and generating or adapting INSTRUCTIONS.md. The bootstrap references the store's INSTRUCTIONS.md as the canonical source.
- **Asset references:** References use the form `[source@]ref[::path]` so that refs (e.g. branch names with slashes) do not collide with path segments. Interpretation of the path is defined by the store's instructions.
