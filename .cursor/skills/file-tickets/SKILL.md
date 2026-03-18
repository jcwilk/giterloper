---
name: file-tickets
description: >-
  Create tickets from the conclusion of the current conversation. Use when
  the user says /file-tickets or wants to turn agreed plans into tickets.
---

# /file-tickets — Create Tickets from Conversation

Turn the **conclusion of the current conversation** into a structured set of tickets. This is a filing-only workflow — do not implement any of the work described.

## Procedure

1. **Extract the conclusion**: Review the conversation. Identify what was agreed, planned, or outlined. Summarize before proceeding.
   - Identify any authoritative markdown spec(s) that govern the behavior (for example `docs/PIN_SETTING_PARAM_BEHAVIOR.md`).
2. **Create an epic**:
   ```
   ./tk create "Epic: <short title>" -t epic -d "<summary>"
   ```
   Note the epic ID.
3. **Break into child tickets**: For each distinct piece of work:
   ```
   ./tk create "Title" --parent <epic-id> -d "<description>" [--design "..."] [--acceptance "..."] [-t feature|task|bug|chore] [-p 0-4]
   ```
   - Write ticket content with high parity to the conversation's agreed source material; avoid unnecessary rewording.
   - If a behavior is defined in authoritative markdown, cite that file path in the ticket description/design and treat it as canonical.
   - Include enough detail in `description`/`design`/`acceptance` so `.cursor/agents/work-next.md` can complete the ticket in isolation.
   - Include concrete acceptance criteria and expected evidence so `.cursor/agents/verifier.md` can definitively assess whether the proposed changes satisfy the ticket.
4. **Model dependencies**: This is critical.
   - `./tk dep <id> <dep-id>` — `id` cannot start until `dep-id` is closed.
   - Run `./tk dep cycle` to verify no cycles.
5. **Verify coverage**: Walk through the conclusion and confirm every item maps to at least one ticket.
6. **Commit and push**: Stage **only** the new `.tickets/*.md` files. Commit as a group (e.g., `Add epic <id>: <title>`). Push to remote.

## Rules

- **Filing only** — do not run `./tk start`, write code, or make changes beyond `.tickets/*.md`.
- Prefer smaller, focused tickets over large monolithic ones.
- Use `--parent` to group under the epic. Use `dep` for ordering constraints.
- Types: `-t feature` (new capability), `-t task` (implementation work), `-t chore` (maintenance), `-t bug` (fix).
- **Truth precedence:** authoritative markdown specs > tests > code. Never file tickets that drift from authoritative markdown unless the user explicitly requests a spec change.
