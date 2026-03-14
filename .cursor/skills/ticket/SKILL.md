---
name: ticket
description: >-
  Manage project tasks with the ticket system. Provides workflows for picking
  up work (/work-next), batch-processing tickets (/work-all), filing new
  tickets from conversation (/file-tickets), persisting changes (/persist),
  and archiving old tickets (/archive-tickets). Use when the user mentions
  tickets, tasks, work items, or any of these slash commands.
---

# Ticket System

This project uses [wedow/ticket](https://github.com/wedow/ticket) for task management.
Tickets are markdown files with YAML frontmatter in `.tickets/`. The CLI is
available at `./tk` from the project root.

Quick reference:

```
./tk ready              # Unblocked tasks, sorted by priority
./tk show <id>          # View a ticket (supports partial IDs)
./tk start <id>         # Mark in-progress
./tk close <id>         # Mark closed
./tk create "Title"     # Create a ticket (see ./tk help for full options)
./tk dep <id> <dep-id>  # id depends on dep-id
./tk list               # All tickets (--status=X, -a ASSIGNEE, -T TAG)
./tk blocked            # Tickets with unresolved deps
./tk closed             # Recently closed tickets
./tk help               # Full usage
```

---

## /work-next — Pick Up Next Ticket

Follow this workflow to pick up the highest-priority available ticket.

1. Run `./tk ready` to see unblocked tickets sorted by priority.
2. Pick the top ticket. Run `./tk start <id>`.
3. Run `./tk show <id>` to read the full description, design, and acceptance criteria.
4. **Discovery**: Explore the codebase and documentation to understand the context.
5. **Strategy**: Propose a plan before writing code. If the task is complex, discuss with the user.
6. **Execute**: Implement the change following project conventions.
7. **Validate**: Run the project's test suite and linter before finishing.
8. **Close and persist**:
   - `./tk close <id>`
   - Stage all relevant changes, commit with a descriptive message referencing the ticket ID.
   - Push to remote.
   - Verify `git status` shows a clean tree and no unpushed commits.

A ticket is **not done** until changes are committed and pushed.

---

## /work-all — Batch-Process All Ready Tickets

Process **all** ready tickets one by one. This is an orchestration workflow — for each ticket, spawn a subagent (or work it yourself) and verify completion before moving on.

### Procedure

1. Run `./tk ready` to get the full list of unblocked tickets.
2. If none, report "No ready tickets" and stop.
3. **For each ticket** (sequentially — never in parallel, to avoid git conflicts):
   a. Spawn a subagent (or work directly) following the **/work-next** workflow above.
   b. **Verify completion** before moving to the next ticket:
      - `./tk show <id>` — status must be `closed`.
      - `git status` — working tree must be clean.
      - `git log -1 --oneline` — confirm a recent commit for this work.
      - Ensure changes are pushed (if ahead of remote, run `git push`).
   c. **If verification fails**: Stop. Do not proceed to the next ticket. Fix the state yourself — stage uncommitted changes, commit, push, close the ticket — then continue. If unresolvable (merge conflicts, user intervention needed), report and stop.
4. After all tickets are done, summarize what was completed.

### Rules

- **Sequential only**: Do not run multiple ticket workers in parallel.
- **Orchestrator responsibility**: If a subagent leaves work incomplete, you must fix it before moving on.
- **Every ticket gets committed and pushed** before the next one starts.

---

## /file-tickets — Create Tickets from Conversation

Turn the **conclusion of the current conversation** into a structured set of tickets. This is a filing-only workflow — do not implement any of the work described.

### Procedure

1. **Extract the conclusion**: Review the conversation. Identify what was agreed, planned, or outlined. Summarize before proceeding.
2. **Create an epic**:
   ```
   ./tk create "Epic: <short title>" -t epic -d "<summary>"
   ```
   Note the epic ID.
3. **Break into child tickets**: For each distinct piece of work:
   ```
   ./tk create "Title" --parent <epic-id> -d "<description>" [--design "..."] [--acceptance "..."] [-t feature|task|bug|chore] [-p 0-4]
   ```
4. **Model dependencies**: This is critical.
   - `./tk dep <id> <dep-id>` — `id` cannot start until `dep-id` is closed.
   - Run `./tk dep cycle` to verify no cycles.
5. **Verify coverage**: Walk through the conclusion and confirm every item maps to at least one ticket.
6. **Commit and push**: Stage **only** the new `.tickets/*.md` files. Commit as a group (e.g., `Add epic <id>: <title>`). Push to remote.

### Rules

- **Filing only** — do not run `./tk start`, write code, or make changes beyond `.tickets/*.md`.
- Prefer smaller, focused tickets over large monolithic ones.
- Use `--parent` to group under the epic. Use `dep` for ordering constraints.
- Types: `-t feature` (new capability), `-t task` (implementation work), `-t chore` (maintenance), `-t bug` (fix).

---

## /persist — Commit and Push

Commit and push changes that are **relevant to the current conversation context**.

### Procedure

1. Run `git status` and `git diff`. Identify which changes belong to the current work.
2. If ambiguous which files to include, **ask the user** before committing.
3. Stage only the relevant files. Write a clear commit message:
   - **Subject**: Imperative mood, ~50 chars. Summarize *what* changed.
   - **Body**: Why the change was made, what problem it solves.
   - **Ticket reference**: Include the ticket ID if applicable (e.g., `til-abc1`).
4. Push to remote.
5. Run `git status` after pushing. If uncommitted changes remain, warn the user and assess whether they should also be committed.

### Rules

- No force push unless explicitly requested.
- No committing secrets — if a staged file might contain secrets, stop and ask.
- Prefer one logical commit per context. Split into multiple commits only when changes are clearly distinct.

---

## /archive-tickets — Archive Closed Tickets

Move closed tickets to `.tickets/.archive/` to keep the active directory manageable. The agent performs this workflow directly using file operations — no separate script.

### Procedure

1. **Preview**: List tickets in `.tickets/*.md` whose YAML frontmatter contains `status: closed`. Optionally filter by age (e.g., only tickets modified more than N days ago). Present the list to the user.
2. **On approval**: Create `.tickets/.archive/` if needed. For each closed ticket to archive, `mv` it to `.tickets/.archive/<filename>`. Skip any that fail the age filter if `--older N` was agreed.
3. **Commit**: `git add .tickets/ && git commit -m "archive closed tickets"`.
4. **Push**.
