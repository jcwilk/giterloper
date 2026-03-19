---
name: work-all
description: >-
  Batch-process all ready tickets one by one. Use when the user says
  /work-all or wants to process all available tickets sequentially.
---

# /work-all — Batch-Process All Ready Tickets

Orchestration only: for each item **`./tk ready`** lists, spawn **`work-next` once** and verify the repo is done before the next iteration. Do **not** implement tickets, run verifier, persist, or mimic `.cursor/agents/work-next.md` in this turn—delegate that to **`work-next`**.

**Queue:** Work-all drains a queue that is already valid in the tracker. If **`./tk ready`** is empty (including on the first run), **stop** and report that there are no ready tickets (or no more, if you already finished some). You may add **one short** note if something looks wrong with the queue (e.g. open tickets all blocked) and **offer** to fix it **if the user wants**—do **not** edit ticket files, deps, or tk metadata unprompted to “create” ready work.

**Re-fetch:** Before **each** new ticket, run `./tk ready` again; do not assume the previous list is still right.

## Procedure

1. `./tk ready`
2. If **none** → stop per **Queue** above.
3. Pick **one** ticket (stable order, e.g. first line).
4. **Spawn `work-next`:** Cursor **Task** tool, `subagent_type: work-next`; prompt includes the ticket id and `.cursor/agents/work-next.md`.
5. Confirm: `./tk show <id>` closed, `git status` clean, recent commit, pushed if ahead. If that fails, **stop**; clean up only fallout from **that** subagent run (commit/close/push as needed), then resume from step 1, or report if stuck.
6. Go to step 1. When step 2 stops you, summarize what completed.

## Rules

- **Sequential only**; one `work-next` per ticket, no parallel workers.
- **Do not call `verifier`** here; `work-next` owns it.
- **Orchestrator cleanup** is for after a subagent run left bad git/ticket state—not for an empty `ready` list before any subagent ran.
