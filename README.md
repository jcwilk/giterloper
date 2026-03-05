# Giterloper

Git-backed knowledge storage: a long-term, incremental source of truth stored in a Git repository, with instructions at the root for how to read and write it. Structure is arbitrary; the instructions are the contract. Agents and tools use the same operations (answer from context, retrieve context, verify claims, add/subtract/intersect knowledge) across stores. All operations accept raw string or asset reference inputs. See [CONSTITUTION.md](CONSTITUTION.md) for the paradigm.

This repository is a giterloper knowledge store about giterloper itself.

## Install access to this knowledge store

Give your agent one of the following (choose by context window and whether you want interactive confirmation):

**Full (interactive):**  
The Giterloper knowledge store contains knowledge about how Giterloper stores and provides knowledge. To install access so that agents working on your project can access that knowledge, read https://github.com/USER/giterloper/blob/main/bootstrap/dist/full.md and follow the instructions.

**Lite (interactive, smaller):**  
The Giterloper knowledge store contains knowledge about how Giterloper stores and provides knowledge. To install access so that agents working on your project can access that knowledge, read https://github.com/USER/giterloper/blob/main/bootstrap/dist/lite.md and follow the instructions (lite variant for smaller context windows).

**Non-interactive:**  
The Giterloper knowledge store contains knowledge about how Giterloper stores and provides knowledge. To install access so that agents working on your project can access that knowledge, read https://github.com/USER/giterloper/blob/main/bootstrap/dist/non-interactive.md and follow the instructions (non-interactive variant; no human in the loop).

## Constitution

The immutable core of the paradigm is [CONSTITUTION.md](CONSTITUTION.md). Verify a copy with [CONSTITUTION.md5](CONSTITUTION.md5). This repo is self-installed: see [.giterloper/constitution.md](.giterloper/constitution.md).
