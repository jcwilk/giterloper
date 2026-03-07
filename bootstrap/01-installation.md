## Installation steps

STOP. Do not run installation until the preamble confirmation is complete.

## 1. Ensure prerequisites

1. `git` available: `git --version`
2. Node.js >= 22 (or Bun): `node --version` (or `bun --version`)
3. QMD available: `qmd status`
4. **CUDA Toolkit** (recommended for GPU acceleration):

   Unlike git, Node.js, and QMD (which are simple pass/fail checks), CUDA is a **decision point**. If an NVIDIA GPU is present but the CUDA Toolkit is not installed, you must stop and get an explicit user choice before proceeding.

   **STOP.** If `nvidia-smi` succeeds but `nvcc` fails, inform the user explicitly. Explain that missing CUDA causes slow qmd commands on *every* invocation, not just the first run. Do not proceed until the user chooses: (a) install the CUDA Toolkit, or (b) explicitly opt into CPU-only mode. Do not run `gl gpu --cpu` without explicit user approval.

   - Run `nvcc --version` to confirm CUDA Toolkit is installed.
   - Run `nvidia-smi` to check if an NVIDIA GPU and driver are present.
   - Install: https://developer.nvidia.com/cuda-downloads (choose Linux, your distro).
   - Ubuntu/Debian example:
     ```sh
     wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb
     sudo dpkg -i cuda-keyring_1.1-1_all.deb
     sudo apt update && sudo apt install cuda-toolkit-13-1
     ```
   - After installing, run `gl gpu` to re-detect. If the user prefers CPU-only, run `gl gpu --cpu` (only after they have explicitly approved).
5. Optional: `vulkaninfo --summary` for Vulkan fallback.

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
.giterloper/local.json
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
mkdir -p .giterloper/versions/<name>
git clone --depth 1 https://<source> .giterloper/versions/<name>/<sha>
git -C .giterloper/versions/<name>/<sha> checkout <sha>
```

Use `INSTRUCTIONS.md` in that checked-out store as canonical mechanics documentation.

## 6. Install the unified `gl` skill

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

## 7. Set up QMD via `gl`

Run from the target project root:

```sh
node <skills-dir>/gl/scripts/gl.mjs setup <name> <source> [--ref <ref>]
```

Or, if the pin and clone are already in place:

```sh
node <skills-dir>/gl/scripts/gl.mjs index
```

The `gl setup` command clones (or reuses an existing clone), detects CUDA/GPU, and runs `qmd embed`. If CUDA is missing but an NVIDIA GPU is present, `gl` will exit with instructions to install the toolkit or run `gl gpu --cpu` to continue in CPU-only mode.

**When `gl setup` exits for this reason:** Present the choice to the user (install CUDA vs CPU-only). Do not run `gl gpu --cpu` without explicit user approval.

Then verify:

```sh
node <skills-dir>/gl/scripts/gl.mjs status
node <skills-dir>/gl/scripts/gl.mjs verify
node <skills-dir>/gl/scripts/gl.mjs search "<topic>"
```

If vectors are unexpectedly missing or zero, re-check collection collisions and rebuild if needed.

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
