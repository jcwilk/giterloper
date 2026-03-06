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

5. **Choose how to surface operations to agents.** The knowledge store defines operations that agents in the target project need to discover and invoke. Ask the user which method they prefer for exposing these operations in the target project. Present these options in priority order:

   1. **AGENTS.md** (recommended default) — Add a section to an `AGENTS.md` file at the project root. This is a widely supported, agent-agnostic format recognized by many coding agents ([agents.md](https://agents.md/)). Best choice when the target project needs to work with a variety of agents and tools.
   2. **Agent Skills (open standard)** — Create a skill folder with a `SKILL.md` following the open Agent Skills standard ([agentskills.io](https://agentskills.io/)). Skills are discoverable packages of procedural knowledge supported by a growing ecosystem of agents. Good when the project already uses skills or wants progressive, on-demand loading of instructions.
   3. **Cursor-specific skills** — If the user works primarily in Cursor, create skills under `.cursor/skills/` following Cursor's discovery conventions ([cursor.com/docs/skills](https://cursor.com/docs/skills)). These are automatically discovered by Cursor's agent. Choose this when Cursor is the primary development environment and broader agent compatibility is not a concern.
   4. **Custom documentation** — The user provides their own guidance on where and how to document the operations. If selected, solicit specific instructions from the user and follow them exactly.

   If the user has no strong preference, recommend AGENTS.md for its broad compatibility.

6. **Decide which operations to expose.** By default, only **read operations** should be surfaced:
   - `answer_from_context`
   - `retrieve_relevant_context`
   - `verify_claim`

   Ask the user whether they also want to expose **write operations** (`add_knowledge`, `subtract_knowledge`, `intersect_knowledge`). Write operations allow agents to mutate the knowledge store by creating branches and pushing changes. Default to **read-only** if the user has no preference.

7. **CONFIRM BEFORE PROCEEDING.** Present a brief summary of your understanding of the installation process, including:
   - Where you've determined to install things (giterloper root path)
   - What the purpose of the knowledge store is
   - Whether the `versions/` directory should be gitignored (default: yes)
   - Which surface method was chosen (AGENTS.md, Agent Skills, Cursor skills, or custom)
   - Whether write operations are enabled or only read operations

   Solicit the user's confirmation. THE USER MUST CONFIRM AND BE GIVEN AN OPPORTUNITY TO OVERRIDE ANY OF THESE DEFAULTS. THIS IS ESSENTIAL FOR SUBSEQUENT STEPS.
