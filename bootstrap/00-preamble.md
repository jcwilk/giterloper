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

2. **Decide on the giterloper root directory.** The default is `.giterloper/`. Inside this directory:
   - `pinned.yaml` maps human-friendly names to store references. This file is committed to the target project.
   - `versions/` holds the actual cloned stores (laid out as `versions/<name>/<ref>/`). This directory is gitignored by default — only the lightweight `pinned.yaml` manifest is committed.

3. **Identify the source.** You need the URL of the giterloper knowledge store to connect to, ie, the canonical access point of this repository.

4. **Choose a name for this store.** Pick a short, human-friendly name that will serve as both the key in `pinned.yaml` and the subdirectory name under `versions/`. For example, `giterloper` for this store.

5. **CONFIRM BEFORE PROCEEDING** Present a brief summary of your understanding of the installation process, where you've determined to install things, and what the purpose of the knowledge store is to solicit confirmation as well as to confirm whether the `versions/` directory should be gitignored (by default it should be) to your user for confirmation. THE USER MUST CONFIRM AND BE GIVEN AN OPPORTUNITY TO OVERRIDE DEFAULTS. THIS IS ESSENTIAL FOR SUBSEQUENT STEPS.
