# Giterloper bootstrap

You are configuring a target repository to use this giterloper knowledge store.

Essential files in this store:
- `CONSTITUTION.md`: normative operation contract
- `INSTRUCTIONS.md`: concrete mechanics and under-the-hood behavior
- `bootstrap/`: install sequence for target projects

Read those before executing installation.

## Before you start

1. **Examine the target project**
   - Language/framework and docs conventions
   - Existing agent surfaces (`AGENTS.md`, `.agents/skills/`, `.cursor/skills/`)
   - Repo policy for external materialization

2. **Use fixed giterloper layout**
   - Root is always `.giterloper/`
   - `.giterloper/pinned.yaml` is committed
   - `.giterloper/versions/` and `.giterloper/staged/` are gitignored

3. **Identify store source and initial ref**
   - Source should be a Git-hostable path (for example `github.com/org/repo`)
   - Resolve branch/tag refs to full SHAs during installation

4. **Choose pin name**
   - Short, human-friendly key for `pinned.yaml`
   - Also becomes directory name under `.giterloper/versions/<name>/`

5. **Choose skill install location**
   Ask the user which location to use:
   1. `.cursor/skills/gl/` (default) — for Cursor-primary workflows
   2. `.agents/skills/gl/` — open Agent Skills standard
   3. Both (one canonical directory + symlink to the other)

   Do not mention AGENTS.md in this question.

6. **AGENTS.md reference** (ask separately)
   Ask: "Is it okay to add information to AGENTS.md about giterloper, or create it if it doesn't exist?" (default: yes).  
   The reference should point to the installed `gl` skill path and not duplicate full instructions.

7. **Choose operation scope**
   - Read workflows only (default), or
   - Read + write workflows

   Note: all commands exist in `gl.mjs`; this choice controls guidance/safety wording, not script availability.

8. **Confirm before proceeding**
   Summarize and ask for explicit confirmation:
   - Store source and initial ref
   - Pin name
   - `.giterloper/` fixed layout and gitignore behavior
   - Prerequisites (including CUDA/GPU status) checked; any GPU present + CUDA missing case confirmed with user
   - Skill install location choice and canonical directory (if both)
   - Whether `AGENTS.md` reference will be added
   - Whether write workflows are enabled

Do not continue to installation until the user confirms and can override defaults.
