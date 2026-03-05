# Giterloper bootstrap

You are installing giterloper into a project so that agents working on that project can access a giterloper knowledge store. This document guides you through the installation.

## Before you start

1. **Examine the target project.** Note:
   - Language(s), framework(s), and existing documentation layout
   - Where config or tooling lives (root, `config/`, `docs/`, etc.)
   - Whether the project already has a `.giterloper/` directory or similar
   - Conventions for hidden vs visible directories (e.g. some prefer `giterloper/` at root instead of `.giterloper/`)

2. **Decide where giterloper will live.** The default is `.giterloper/` at the repository root. If the project standard is different (e.g. `tools/giterloper/`, `docs/.giterloper/`), adapt. The constitution copy and any generated files must live in one consistent place.

3. **Identify the source.** You need the URL of the giterloper knowledge store to install from (e.g. the repo that contains this bootstrap), and the path to the constitution and its MD5 file. Typically: same repo, `CONSTITUTION.md` and `CONSTITUTION.md5` at root.
