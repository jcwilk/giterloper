# How it works

This folder holds knowledge about the mechanics of giterloper.

- **Constitution:** An immutable (per-version) document defines the paradigm: Git dependency, six required operations, asset reference scheme. It is copied verbatim into installed projects and verified via MD5.
- **Instructions:** Each knowledge store has an INSTRUCTIONS.md (or equivalent) that explains how to perform the six operations on that store's structure. All operations accept raw string or asset reference inputs. Structure is arbitrary; the instructions are the contract.
- **Bootstrap:** Installing giterloper into a project means adding a `.giterloper/` directory (or project-equivalent), copying the constitution, and generating or adapting INSTRUCTIONS.md for that project. Bootstrap comes in full, lite, and non-interactive variants.
- **Asset references:** References use the form `[source@]ref[::path]` so that refs (e.g. branch names with slashes) do not collide with path segments. Interpretation of the path is defined by the store's instructions.
