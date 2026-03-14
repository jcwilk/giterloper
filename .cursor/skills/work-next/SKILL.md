---
name: work-next
description: >-
  Pick up the highest-priority available ticket and complete it. Use when
  the user says /work-next or wants to work on the next ticket.
---

# /work-next — Pick Up Next Ticket

Follow this workflow to pick up the highest-priority available ticket.

1. Run `./tk ready` to see unblocked tickets sorted by priority.
2. Pick the top ticket. Run `./tk start <id>`.
3. Run `./tk show <id>` to read the full description, design, and acceptance criteria.
4. **Discovery**: Explore the codebase and documentation to understand the context.
5. **Strategy**: Propose a plan before writing code. If the task is complex, discuss with the user.
6. **Execute**: Implement the change following project conventions.
7. **Validate**: Run the project's test suite and linter before finishing.
8. **Close, commit, and push**:
   - `./tk close <id>`
   - Stage all relevant changes, commit with a descriptive message referencing the ticket ID.
   - Push to remote.
   - Verify `git status` shows a clean tree and no unpushed commits.

A ticket is **not done** until changes are committed and pushed.
