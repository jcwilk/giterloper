---
name: work-all
description: >-
  Batch-process all ready tickets one by one. Use when the user says
  /work-all or wants to process all available tickets sequentially.
---

# /work-all — Batch-Process All Ready Tickets

Process **all** ready tickets one by one. This is an orchestration workflow — for each ticket, spawn the `work-next` subagent and confirm the repo is left in a done state before moving on.

## Procedure

1. Run `./tk ready` to get the full list of unblocked tickets.
2. If none, report "No ready tickets" and stop.
3. **For each ticket** (sequentially — never in parallel, to avoid git conflicts):
   a. **Spawn the `work-next` subagent** for this specific ticket ID. Do not work on tickets inline yourself.
   b. **Confirm completion state** before moving to the next ticket:
      - `./tk show <id>` — status must be `closed`.
      - `git status` — working tree must be clean.
      - `git log -1 --oneline` — confirm a recent commit exists for this work.
      - Ensure changes are pushed (if ahead of remote, run `git push`).
   c. **If state checks fail**: Stop. Do not proceed to the next ticket. Fix the state yourself — commit/push pending ticket changes and close the ticket if appropriate — then continue. If unresolvable (merge conflicts, user intervention needed), report and stop.
4. After all tickets are done, summarize what was completed.

## Rules

- **Subagents required**: One `work-next` subagent run per ticket. Do not work on tickets inline.
- **Sequential only**: Do not run multiple ticket workers in parallel.
- **Orchestrator responsibility**: If a subagent leaves incomplete state, clean it up before moving on.
- **Every ticket must end closed with a clean working tree** before the next one starts.
- **Do not call the `verifier` subagent from `work-all`**; `work-next` handles that step.
