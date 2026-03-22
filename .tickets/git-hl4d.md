---
id: git-hl4d
status: open
deps: []
links: []
created: 2026-03-22T15:12:13Z
type: chore
priority: 2
assignee: user.email
parent: git-x96q
---
# Memsearch: local install and PATH for dev/CI

Prerequisite for implementing and verifying git-uqw4. Normative: specs/MCP.md (memsearch mandatory at MCP startup). Deliver contributor-facing steps so memsearch CLI is on PATH: e.g. Python venv or system pip per lib/memsearch-adapter.ts and docs/DEPLOYMENT_REQUIREMENTS.md §2. Update AGENTS.md and tests/README.md (and README test section if appropriate) so memsearch is listed as required for MCP server runs, reference_client/search tests, and full ./scripts/check_all.sh after boot-time check lands—not optional for those flows (normative MCP vs CLI distinction stays in specs and **git-r51w**). If .github/workflows exist, add a memsearch install step (pip) before test job; if absent, document in ticket note for future CI. Do not remove **reference_client** test **ignore** or rewrite **reference_client/README.md** beyond a cross-link—**git-r51w** owns that.

## Acceptance Criteria

Docs clearly state **how to install** memsearch (e.g. `pip install memsearch`) and that the **`memsearch` CLI is on `PATH`** for dev/test before running MCP, **reference_client** search tests, and (once **git-uqw4** lands) full **`./scripts/check_all.sh`**. **AGENTS.md** and **tests/README.md** carry that prerequisite; root **README** test blurb updated if it contradicts. **Normative** “optional vs mandatory” product wording for MCP vs CLI may be completed in **git-r51w**—here, focus on **install + PATH + where it is required**. CI: add a **pip install memsearch** (or equivalent) step when **`.github/workflows`** exist; if none, add a short **closed-ticket note** that CI must install memsearch when added. **git-uqw4** can assume this documented baseline. **reference_client** ignore removal and **reference_client/README** contract edits stay in **git-r51w** unless a trivial cross-link is needed here.

