---
name: work-all
description: >-
  Batch-process all ready tickets one by one. Use when the user says
  /work-all or wants to process all available tickets sequentially.
---

# /work-all — Batch-Process All Ready Tickets

Process **all** ready tickets one by one. This is an orchestration workflow — for each ticket, spawn the `work-next` subagent and confirm the repo is left in a done state before moving on.

**Important:** Do not snapshot the ready list once and iterate it. Closing a ticket can unblock others. **Before every ticket**, fetch the current ready set again so newly unblocked work is picked up.

## Procedure

1. Run `./tk ready` to get the **current** full list of unblocked tickets.
2. If none, report "No ready tickets" (or "No more ready tickets" if you already completed some) and stop.
3. **Pick one ticket** from that list (use a stable choice, e.g. first in `./tk ready` output, or whatever ordering the project uses — but only one per iteration).
4. **Spawn the `work-next` subagent** for that ticket ID only. Do not work on tickets inline yourself.
5. **Confirm completion state** before the next iteration:
   - `./tk show <id>` — status must be `closed`.
   - `git status` — working tree must be clean.
   - `git log -1 --oneline` — confirm a recent commit exists for this work.
   - Ensure changes are pushed (if ahead of remote, run `git push`).
6. **If state checks fail**: Stop. Do not proceed. Fix the state yourself — commit/push pending ticket changes and close the ticket if appropriate — then resume the loop from step 1. If unresolvable (merge conflicts, user intervention needed), report and stop.
7. **Go back to step 1** — run `./tk ready` again and continue until step 2 applies (empty list). Then summarize what was completed across the session.

## Rules

- **Re-fetch ready tickets every iteration**: After each closed ticket (and clean push), run `./tk ready` again before choosing the next ticket — never assume the initial list is still complete.
- **Subagents required**: One `work-next` subagent run per ticket. Do not work on tickets inline.
- **Sequential only**: Do not run multiple ticket workers in parallel.
- **Orchestrator responsibility**: If a subagent leaves incomplete state, clean it up before moving on.
- **Every ticket must end closed with a clean working tree** before the next one starts.
- **Do not call the `verifier` subagent from `work-all`**; `work-next` handles that step.
