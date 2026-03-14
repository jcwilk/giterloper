---
name: work-all
description: >-
  Batch-process all ready tickets one by one. Use when the user says
  /work-all or wants to process all available tickets sequentially.
---

# /work-all — Batch-Process All Ready Tickets

Process **all** ready tickets one by one. This is an orchestration workflow — for each ticket, spawn a subagent (or work it yourself) and verify completion before moving on.

## Procedure

1. Run `./tk ready` to get the full list of unblocked tickets.
2. If none, report "No ready tickets" and stop.
3. **For each ticket** (sequentially — never in parallel, to avoid git conflicts):
   a. Spawn a subagent (or work directly) following the **work-next** skill workflow.
   b. **Verify completion** before moving to the next ticket:
      - `./tk show <id>` — status must be `closed`.
      - `git status` — working tree must be clean.
      - `git log -1 --oneline` — confirm a recent commit for this work.
      - Ensure changes are pushed (if ahead of remote, run `git push`).
   c. **If verification fails**: Stop. Do not proceed to the next ticket. Fix the state yourself — stage uncommitted changes, commit, push, close the ticket — then continue. If unresolvable (merge conflicts, user intervention needed), report and stop.
4. After all tickets are done, summarize what was completed.

## Rules

- **Sequential only**: Do not run multiple ticket workers in parallel.
- **Orchestrator responsibility**: If a subagent leaves work incomplete, you must fix it before moving on.
- **Every ticket gets committed and pushed** before the next one starts.
