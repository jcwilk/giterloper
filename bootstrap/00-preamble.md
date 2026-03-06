# Giterloper bootstrap

You are configuring the connection between a target repository (the rproject you're working on) and a giterloper knowledge store (this repository) so that agents working on the target project can access this store's knowledge.

Essential files in this store:
* `CONSTITUTION.md` at the project root defines the overall giterloper paradigm this repository adheres to.
* `INSTRUCTIONS.md` at the project root is specific to this version of the repo and explains how to perform operations and access the knowledge.

Fetch these now and understand them before proceeding.

Installation files:
* The `bootstrap/` files (of which this file is the first) define the installation process and guide the agent (you) through how to configure your project to access this knowledge store and what to confirm with your user, if possible.

## Before you start

1. **Examine the target project.** Note:
   - Language(s), framework(s), and existing documentation layout
   - Where config or tooling lives (root, `config/`, `docs/`, etc.)
   - Project conventions for external dependencies (cloned repos, vendored content)

2. **Decide where the store clone will live.** The recommended layout is `.giterloper/<remote>/<version>/` — each cloned version (e.g. `main`, `v1.0.0`) goes in its own subdirectory. Some operations may require checking out multiple versions at the same time.

3. **Identify the source.** You need the URL of the giterloper knowledge store to connect to, ie, the canonical access point of this repository.

4. **Confirm with your user.** Present a brief summary of your understanding of the installation process, where you've determined to install things, and what the purpose of the knowledge store is to solicit confirmation as well as to confirm whether the cloned versions should be gitignored (by default they should be gitignored).
