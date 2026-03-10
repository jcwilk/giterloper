# Setup

## 1. Ensure prerequisites

1. `git` available: `git --version`
2. Deno: `deno --version` (install from https://deno.land)
3. QMD available: `qmd status` (if not on PATH, run `npm install -g @tobilu/qmd`)
5. **CUDA Toolkit** (recommended for GPU acceleration):

   If an NVIDIA GPU is present but the CUDA Toolkit is not installed, you must stop and get an explicit user choice before proceeding.

   **STOP.** If `nvidia-smi` succeeds but `nvcc` fails, inform the user explicitly. Explain that missing CUDA causes slow qmd commands on every invocation. Do not proceed until the user chooses: (a) install the CUDA Toolkit, or (b) explicitly opt into CPU-only mode. Do not run `gl-extended gpu --cpu` without explicit user approval.

   - Run `nvcc --version` to confirm CUDA Toolkit is installed.
   - Run `nvidia-smi` to check if an NVIDIA GPU and driver are present.
   - Install: https://developer.nvidia.com/cuda-downloads
   - Ubuntu/Debian example:
     ```sh
     wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb
     sudo dpkg -i cuda-keyring_1.1-1_all.deb
     sudo apt update && sudo apt install cuda-toolkit-13-1
     ```
   - After installing, run `./.cursor/skills/gl/scripts/gl-extended gpu` to re-detect. If the user prefers CPU-only, run `./.cursor/skills/gl/scripts/gl-extended gpu --cpu` (only after they have explicitly approved).
6. Optional: `vulkaninfo --summary` for Vulkan fallback.

## 2. Materialize the knowledge store

From the Giterloper project root (which has `pinned.yaml` committed):

```sh
./.cursor/skills/gl/scripts/gl-extended clone
./.cursor/skills/gl/scripts/gl-extended index
```

`gl-extended clone` fetches pinned stores into `.giterloper/versions/`. `gl-extended index` adds qmd collections and runs `qmd embed`. If CUDA is missing but an NVIDIA GPU is present, the command will exit with instructions; present the choice to the user before proceeding. (Normally `gl pin add` materializes automatically; use clone/index only when restoring from existing pinned.yaml.)

## 3. Creating a new branch (optional)

To work on a new branch without manual git:

```sh
gl pin add my_branch github.com/owner/knowledge --ref main --branch my_branch
```

If the branch does not exist on the remote, gl creates it automatically on the first write (add, reconcile). Use `--ref` to branch from main, a tag, or another ref.

See `02-verification.md` for verification steps.
