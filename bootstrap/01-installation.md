## Installation steps

STOP. Do not run installation until the preamble confirmation is complete.

## 1. Ensure prerequisites

1. `git` available: `git --version`
2. Node.js >= 22 (or Bun): `node --version` (or `bun --version`)
3. QMD available: `qmd status`
4. Optional acceleration checks (recommended):
   - `nvidia-smi` and `nvcc --version` for CUDA
   - `vulkaninfo --summary` for Vulkan fallback

If QMD repeatedly reports CUDA Toolkit build failures, resolve toolchain before continuing.

## 2. Create `.giterloper/pinned.yaml`

Resolve SHA from user ref:

```sh
SHA=$(git ls-remote https://<source> <human-ref> | cut -f1)
```

Write:

```yaml
# .giterloper/pinned.yaml
<name>: <source>@<sha>
```

Pins must use full 40-character SHAs.

## 3. Add required `.gitignore` entries

Ensure these entries exist:

```gitignore
.giterloper/versions/
.giterloper/staged/
```

Do not ignore the entire `.giterloper/` directory because `pinned.yaml` must be committed.

## 4. Add README section

Document the fixed layout and materialization path:

```markdown
## Giterloper knowledge stores

This project uses [giterloper](https://github.com/jcwilk/giterloper) knowledge stores.
Store connections are defined in `.giterloper/pinned.yaml`:

    <name>: <source>@<sha>

Each pin uses an exact commit SHA. Cloned stores are materialized under:

    .giterloper/versions/<name>/<sha>/

These clones are gitignored. Temporary write clones are created under:

    .giterloper/staged/<name>/<branch>/

Use the installed `gl` skill (`gl.mjs`) as the primary operation interface.
```

## 5. Clone the store

Clone to:

```sh
git clone --depth 1 https://<source> .giterloper/versions/<name>/<sha>
git -C .giterloper/versions/<name>/<sha> checkout <sha>
```

Use `INSTRUCTIONS.md` in that checked-out store as canonical mechanics documentation.

## 6. Set up QMD (present commands; do not blindly auto-run)

Run:

```sh
qmd collection add .giterloper/versions/<name>/<sha>/knowledge --name <name>@<sha> --mask "**/*.md"
qmd context add qmd://<name>@<sha> "<store description>"
qmd embed
```

Then verify:

```sh
qmd status
qmd search "<topic>" -c <name>@<sha>
```

If vectors are unexpectedly missing or zero, re-check collection collisions and rebuild if needed.

## 7. Install the unified `gl` skill

The store clone includes source files at:

```text
.giterloper/versions/<name>/<sha>/bootstrap/skill/
```

Pick destination based on preamble decision:
- `.agents/skills/gl/`
- `.cursor/skills/gl/`

Copy with a literal filesystem operation:

```sh
mkdir -p <skills-dir>/gl
cp -r .giterloper/versions/<name>/<sha>/bootstrap/skill/* <skills-dir>/gl/
chmod +x <skills-dir>/gl/scripts/gl.mjs
```

IMPORTANT: use `cp` (or equivalent literal copy). Do **not** read and regenerate `gl.mjs` or `SKILL.md`.

Optional: if read-only scope was chosen, add a short note in copied `SKILL.md` stating write workflows are disabled for this project.

## 8. Optional `AGENTS.md` reference

If requested, add:

```markdown
## Giterloper knowledge store

This project is connected to a [giterloper](https://github.com/jcwilk/giterloper) knowledge store.
Use the installed `gl` skill at `<skills-dir>/gl/` for operations and workflow guidance.
If local materialization is missing, run:

    node <skills-dir>/gl/scripts/gl.mjs setup --help
```

## 9. If both skill directories were selected

Create one canonical install and symlink the other:

```sh
ln -s <canonical-skills-dir>/gl <other-skills-dir>/gl
```

## 10. Initial smoke checks

Run from the target project root:

```sh
node <skills-dir>/gl/scripts/gl.mjs status
node <skills-dir>/gl/scripts/gl.mjs verify
```

If either command fails, resolve state issues before marking setup complete.
