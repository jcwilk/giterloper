# Agent Guidance for Giterloper

This document captures conventions, gotchas, and guidance for AI agents and contributors working in this repository.

**Layered truth (root vs `specs/` vs tests vs code):** read the full mandate in **[HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md](./HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md)**—it defines orthogonality, precedence within a product slice, **`docs/` demotion** (operational notes, not a lock on product truth), **hierarchical alignment** vs **hierarchical divergence**, verifier expectations for area specs, and rules for spec scope and growth.

**This file is the canonical place** to nudge reading other root onboarding/instruction docs, the mandate, **`specs/*`**, [tests/README.md](./tests/README.md), and the ticket **verifier** agent definition under **`.cursor/agents/`** for agent workflows. For **verifier**-shaped gates, **spawn** the **`verifier`** subagent via Task—do not impersonate it inline (see **Skills vs agents** below). **`specs/`**, **tests/README**, the verifier definition, and **`lib/`** do not repeat “see AGENTS” hooks; they assume these universal rules. **Routine edits to AGENTS.md are rare and human-directed**—do not treat refreshing AGENTS, filing tickets for wording-only AGENTS churn, or spec-change machinery as default workflow for small doc tweaks.

**Orthogonality** (root instructions vs `specs/*`) is defined in the mandate (**§1**). Area specs conform to repo-wide root instructions, not the other way around.

### Spec path literals

**Tier (a) — allowlisted hubs (concrete `specs/<file>.md` paths are appropriate where navigation needs them):** **Where to read contracts** and **pairing** in this file; the slice consultation table in **`.cursor/agents/verifier.md`**; harness and anchoring conventions in **`tests/README.md`**; and the slice hub at **[specs/README.md](./specs/README.md)** (authoritative list of area spec paths—prefer linking the hub over duplicating a full file list here).

**Tier (b) — area specs:** Files under **`specs/`** may use precise cross-links and deferrals to sibling slice files.

**Tier (c) — process-oriented prose:** Skills under **`.cursor/skills/`**, mandate narrative, CONTRIBUTING-style notes, and **generic** comments in root / **`lib/`** / **`docs/`** should use slice labels or **`specs/`** without enumerating real basenames unless the sentence is **literally about that exact file**—see **Examples in instruction text** below.

**Reserved for alignment work:** Ticket bodies, verifier consultation prompts, and **file-tickets** / **work-next** citations may keep concrete **`specs/<file>.md`** paths where they anchor spec–test–code alignment (consistent with pairing obligations).

**Pairing invariant:** Nothing here relaxes **CLI help ↔ CLI slice spec** or **MCP tool strings ↔ MCP slice spec** synchronization; when those surfaces drift, fix them **together** (see **Pairing slice specs with user-visible strings** below).

**Examples in instruction text (tier (c)):** Process-oriented markdown (this file, skills, mandate, CONTRIBUTING-style notes, and **generic** code comments) should **not** use **real repository paths or filenames** as illustrations of “general rules” (for example listing specific `specs/*.md` files to mean “and any related normative docs”). That pattern **couples** guidance to the current layout: a spec split or rename forces wide, low-value churn. **Prefer contrived placeholders** (“the applicable area spec(s) under `specs/`”, `specs/<slice>.md`) when the point is universal. **Exception:** when the text is **literally about that exact file**—not a stand-in for “any normative doc”—concrete paths are appropriate; navigational slice links live in **Where to read contracts** (following section) and in **[specs/README.md](./specs/README.md)** (tier (a)).

## Skills vs agents (orchestration)

**`.cursor/skills/`** is for procedures the **current** agent executes **inline** in this conversation: read the skill, follow it here, use normal tools.

**`.cursor/agents/`** is for **subagent** workflows: spawn with the **Task** tool using the matching **`subagent_type`**. Pass a self-contained prompt; the subagent owns its loop.

### Subagents (`agents/*.md`) — Task only

**Mandatory:** Workflows under **`.cursor/agents/`** run **only** via the **Task** tool with the matching **`subagent_type`** (same stem as the file, e.g. **`verifier`**, **`work-next`**, **`critique-and-refine`**, **`spec-change`**). Pass a **self-contained** prompt; the subagent owns its loop.

**Do not impersonate subagents in the parent thread.** That includes opening an **`agents/*.md`** file and following it inline, **and** reproducing the same steps yourself without Task—both collapse delegation and break the isolation those definitions assume. An **ALL-CAPS “spawn as subagent” banner** at the top of an agent file means **use Task**, not “treat this file as instructions for the current chat.”

**You must Task the subagent when any of these apply (non-exhaustive):** the user **@**-references or invokes a slash command at an **`agents/*.md`** definition. **Heavier surrounding tasks** (e.g. “also update these files afterward”) **do not** cancel subagent delegation—run the subagent first unless the user **explicitly** waives it.

## Source-of-truth precedence (CRITICAL)

**Layer order**, **repair direction** when spec, tests, and code disagree on product behavior, **`docs/` demotion**, **alignment vs divergence**, **rollout and ongoing test/spec pairing**, **spec scope**, **conflict examples**, and **required agent behaviors** are defined in **[HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md](./HIERARCHICAL_TRUTH_AND_ALIGNMENT_MANDATE.md)** (**§2**, **Summary**, and related sections). **Read that document** for the full stack; this section does not duplicate it.

**Where to read contracts:** Use **[specs/README.md](./specs/README.md)** as the slice hub—each **area spec** lives at **`specs/<slice>.md`** (stem matches the slice name unless the hub documents an exception). Cross-cutting slices (for example **reconcile** semantics shared by CLI and MCP) are listed there too. For a given change, open the **slice** you are touching (CLI, MCP, core, pin semantics, reconciliation, …) via the hub rather than assuming filenames from prose here.

**Pairing slice specs with user-visible strings:** **CLI** help and other user-visible CLI contract text **MUST** stay **intentionally in sync** with the **CLI** area spec; **MCP** tool descriptions and user-visible MCP strings **MUST** stay in sync with the **MCP** area spec; shared **reconcile** behavior **MUST** stay alignable with the **reconciliation** slice and with CLI/MCP surface text for **`gl reconcile`** / **`giterloper_reconcile_pending`**. Paths for those specs are in **[specs/README.md](./specs/README.md)**. **A conflict between the slice spec and its paired user-facing strings is a bug**—fix help, descriptions, spec, or implementation **together**; do not silently prefer one side. Slice specs **do not** need to cite AGENTS or restate the full repo-wide stack.

**Normative MCP behavior** is defined only under the **MCP slice** (see **[specs/README.md](./specs/README.md)** and linked area specs); there is no separate MCP contract at the repository root.

**Judgement and spec edits:** When work introduces **materially new** product behavior that belongs in the written contract, update the relevant **`specs/*`** in **task-scoped** fashion only (no drive-by spec edits; no numeric “coverage” quota—use judgement). See the mandate for strict alignment at rollout, **what “mention” means** in specs (**§6**), and pairing rules.

**Changing normative contracts** (editing authoritative area specs, revising CLI/MCP-facing contract text, or implementing behavior that contradicts them) requires **explicit user direction**—do not "fix" drift by silently rewriting the contract.

## Task Tracking

Use the `Ticket` system (`wedow/ticket`) for all tracked work. Access it via `./tk`. Run `./tk` with no arguments to see full usage (create, start, close, ready, blocked, closed, show, dep, etc.). There is no `./tk list` command — use `ready` / `blocked` / `closed` to list tickets.

**Task completion requires commit and push.** A closed ticket with a dirty tree is not done.

Ticket-related workflows are defined under **`.cursor/skills/`** (inline procedures) and **`.cursor/agents/`** (Task subagents); they are user-invoked, not automatic.

### Git branches and `main` (default)

**Default:** Keep working on the **current** git branch. **Push** that branch to **`origin`** when persisting (ticket work, **`persist`**, skills that say commit/push). **Do not** merge the current branch into **`main`**, fast-forward **`main`**, or integrate into the default branch **unless the user explicitly asks** (e.g. merge to **`main`**, land on default branch, open/merge a PR into **`main`**). Absent that, assume **all commits stay on the current branch** until the user moves them.

This does **not** relax **commit and push**: pushes target the **remote for the current branch**, not a merge into **`main`**.

## Run environment: native for dev/test, Docker for prod

**Development and tests** use **native Deno** (and git; **Python + memsearch** when running the MCP server or search-related tests) on the host. This keeps feedback loops fast for agents and contributors: run the CLI, MCP server, and tests directly without container overhead. **MCP** treats **memsearch** as mandatory at server startup (see **MCP** in **[specs/README.md](./specs/README.md)**); **`gl`** / **`gl-maintenance`** do not require it at CLI boot (see **CLI** there).

### memsearch (install and `PATH`)

Giterloper invokes the **`memsearch`** CLI as a subprocess; see the memsearch adapter under **`lib/`** and [docs/DEPLOYMENT_REQUIREMENTS.md](./docs/DEPLOYMENT_REQUIREMENTS.md) §2 for runtime assumptions. **MCP** still **fails fast** if `memsearch` is not on **`PATH`** at process start (see **MCP** in **[specs/README.md](./specs/README.md)**).

**Default ingress (no manual venv step):** the repo **`check_all`** script under **`scripts/`**, **`deno task check`**, **`deno task test`**, and the MCP **`deno task`** variants run through the bootstrap / **`with-memsearch`** wrappers in **`scripts/`** (see **`deno.json`** for task names). If `memsearch` is not already available, they create **repo-root `.venv`**, **`pip install memsearch`** there, and prepend **`.venv/bin`** (or **`.venv/Scripts`** on Windows) to **`PATH`** for that process and its children. **Python 3** must be on **`PATH`** (`python3 -m venv`).

**Manual install** (optional—for shells where you invoke **`deno run`** on the MCP server entrypoint in **`lib/`** directly without the **`with-memsearch`** wrapper, or to match production Docker):

```bash
pip install memsearch
# or: python3 -m venv .venv && .venv/bin/pip install memsearch
```

The **`gl`** / **`gl-maintenance`** CLIs do **not** require memsearch at process startup (see **CLI** in **[specs/README.md](./specs/README.md)**); search- or index-backed commands may fail at invocation time if memsearch is missing.

- **CLI:** invoke **`gl`** via the **`gl`** skill script under **`.cursor/skills/gl/`** from workspace root (see that skill for the stable path).
- **MCP server:** **`deno task`** targets for MCP (see **`deno.json`**—typically **`mcp:serve`** / **`mcp:serve-stdio`**) from workspace root; they pass **`--env-file=.env`**; copy **`.env.example`** → **`.env`** and fill remotes first. For MCP test mode (session under **`.giterloper_test`**), use the **`:test`** variants of those tasks. A raw **`deno run`** without **`--env-file`** does **not** load repo **`.env`**—use the tasks or pass **`--env-file=.env`** yourself.
- **Tests:** **`deno task test`** or **`deno run -A`** on the unified harness entrypoint in **`scripts/`** (see **`deno.json`**); harness layout, discovery, and topic tests are documented in [tests/README.md](./tests/README.md). **Typecheck:** **`deno task check`** (see **`deno.json`**).

**Production** uses **Docker**. The same image runs on Fly.io (see [docs/FLY_IO_DEPLOYMENT.md](./docs/FLY_IO_DEPLOYMENT.md)). Optional: run the MCP server in Docker locally for parity with production (Docker helper under **`scripts/`**); day-to-day dev and tests remain native.

## Coding Conventions

See [CONVENTIONS.md](./CONVENTIONS.md) for type-safety, interface/type usage, strict mode requirements, and **external retries** (git, GitHub) logging behavior.

## Testing Strategy (CRITICAL)

A rigorous, thoughtfully designed test suite is essential for agentic coding. It is the clearest way to verify that implemented behavior matches intended behavior.

Keep topic integration tests high-signal and intentionally scoped: less is more. Avoid overlapping scenarios and competing sources of truth. Layout, execution, shared-remote collision avoidance, independence, cleanup, and session directories under **`.giterloper/<sessionId>/`** are defined in [tests/README.md](./tests/README.md).

## Project Structure

**`lib/`** — application source (CLI, MCP shared core, git/pin helpers, etc.).

**`tests/`** — topic-based product-behavior tests; see [tests/README.md](./tests/README.md).

**`specs/`** — normative product contracts by slice.

**`scripts/`** — check, test harness, Docker, and maintenance entrypoints.

**`.cursor/skills/`**, **`.cursor/agents/`** — inline skills and Task subagent definitions.

**`docs/`** — operational and deployment notes (not a lock on product truth; see mandate). **`.tickets/`** — ticket files. Session state lives under **`.giterloper/`** / **`.giterloper_test/`** per [tests/README.md](./tests/README.md) and the MCP slice.

## Cursor Cloud specific instructions

### Prerequisites

- **Deno** and **Git** are available in the VM. If Deno is missing: `curl -fsSL https://deno.land/install.sh | sh`
- For **MCP server** runs or tests that exercise search: **Python** + **`memsearch` on `PATH`** (see **Run environment** → **memsearch** above).

### Git access to knowledge repos

**Cloud:** GITERLOPER_GH_TOKEN is available in Cursor Cloud. Assume it is set.

**Local:** Either set GITERLOPER_GH_TOKEN or use session-based auth (`gh auth login` for merge API; git credential helper for clone/push).

When GITERLOPER_GH_TOKEN is set, gl and the integration test helpers embed it in HTTPS URLs — no gitconfig changes required. When not set, git operations use credential helper (e.g. `gh auth git-credential`), and the merge API uses `gh auth token`. The token provides **read** on `jcwilk/giterloper_knowledge` and **read + write** on `jcwilk/giterloper_test_knowledge` for integration tests.

CLI and MCP integration tests run in this environment when the token is available. Flows that start the MCP server or exercise **`giterloper_search`** also need **`memsearch` on `PATH`** (see **Run environment** → **memsearch**).

### Running the CLI

All **`gl`** commands run from the workspace root. Use the **`gl`** skill (**`.cursor/skills/gl/`**) for the supported wrapper command; the skill README stays authoritative if the path changes.

**Setup:** For **`gl`** alone, git and Deno suffice. For the **MCP server** or suites that exercise **memsearch**-backed search, install **memsearch** on **`PATH`** first (see **Run environment** → **memsearch**). Use `gl pin add` to add a pin (clones automatically) or `gl pin load` to clone existing pins. Run `gl diagnostic` to verify state.

### gl maintenance (debugging and maintenance)

A separate **gl maintenance** CLI exposes low-level commands for debugging and maintenance. It has **no overlap** with main gl commands.

**Invoke gl maintenance:** the **`gl-maintenance`** script under **`scripts/`**, or **`deno run -A`** on the matching entrypoint in **`lib/`** (see **`deno.json`** / tree layout if names shift).

**Commands:** `status`, `verify`, `clone`, `teardown`, `stage`, `stage-cleanup`, `promote`. Run **`--help`** on that entrypoint for usage.

**When to use:** Only when debugging failed operations, performing manual maintenance (e.g. re-cloning without pin add), or running tests. Prefer main `gl` commands (`diagnostic`, `pin add`, `pin update`, `pin load`, etc.) for normal agent workflows.

**Directive:** Do **not** invoke gl maintenance for routine tasks. If a main `gl` command fails, run `gl diagnostic` first to understand state. Use gl maintenance only when explicitly debugging/maintaining (e.g. user asks to re-clone, or you are fixing a corrupted clone). Prefer the narrower main command surface to reduce confusion and make agent behavior easier to debug.

### Running tests

See [tests/README.md](./tests/README.md) for canonical test execution commands and integration-test prerequisites (shared test repo, auth).

### MCP server (operational)

Tool names, session pin semantics, transport parity, env requirements, HTTP endpoints, and auth are normative in the **MCP** area spec (see **[specs/README.md](./specs/README.md)** for the path).

**Run (native):** Prefer the MCP **`deno task`** targets (see **`deno.json`**) so **`--env-file=.env`** is applied (requires a Deno build that supports **`deno run --env-file=...`**). MCP test mode uses the **`:test`** task variants (append **`--mcp-test-mode`** if you invoke **`deno run`** manually). Copy **`.env.example`** → **`.env`**; variable semantics and test-mode rules are in the MCP slice.

**Cursor (stdio MCP):** Whether repo **`.env`** is loaded depends on how the server is started—the **`deno.json`** tasks pass **`--env-file=.env`**; a raw **`deno run`** without that flag does not load it. If your Cursor MCP launch command omits **`--env-file`**, provide the same variable **names** and **values** via **Cursor Settings → MCP** (or the parent environment) so the process sees **`KNOWLEDGE_STORE_REMOTE`** / **`TEST_KNOWLEDGE_STORE_REMOTE`** as needed.

For production (Fly.io) or optional local Docker run, see [docs/FLY_IO_DEPLOYMENT.md](./docs/FLY_IO_DEPLOYMENT.md).

### Typecheck

Run **`deno task check`** (see **`deno.json`**) for the canonical check pipeline. No separate build step—Deno runs TypeScript directly.
