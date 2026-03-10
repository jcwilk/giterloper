# Setup

## 1. Ensure prerequisites

1. `git` available: `git --version`
2. Deno: `deno --version` (install from https://deno.land)
3. QMD available: `qmd status` (if not on PATH, run `npm install -g @tobilu/qmd`)
5. **CUDA Toolkit** (recommended for GPU acceleration):

   If an NVIDIA GPU is present but the CUDA Toolkit is not installed, you must stop and get an explicit user choice before proceeding.

   **STOP.** If `nvidia-smi` succeeds but `nvcc` fails, inform the user explicitly. Explain that missing CUDA causes slow qmd commands on every invocation. Do not proceed until the user chooses: (a) install the CUDA Toolkit, or (b) explicitly opt into CPU-only mode. Do not run `gl gpu --cpu` without explicit user approval.

   - Run `nvcc --version` to confirm CUDA Toolkit is installed.
   - Run `nvidia-smi` to check if an NVIDIA GPU and driver are present.
   - Install: https://developer.nvidia.com/cuda-downloads
   - Ubuntu/Debian example:
     ```sh
     wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb
     sudo dpkg -i cuda-keyring_1.1-1_all.deb
     sudo apt update && sudo apt install cuda-toolkit-13-1
     ```
   - After installing, run `gl gpu` to re-detect. If the user prefers CPU-only, run `gl gpu --cpu` (only after they have explicitly approved).
6. Optional: `vulkaninfo --summary` for Vulkan fallback.

## 2. Materialize the knowledge store

From the Giterloper project root (which has `pinned.yaml` committed):

```sh
deno run -A lib/gl.ts clone
deno run -A lib/gl.ts index
```

Or: `npm run gl -- clone` and `npm run gl -- index`

`gl clone` fetches pinned stores into `.giterloper/versions/`. `gl index` adds qmd collections and runs `qmd embed`. If CUDA is missing but an NVIDIA GPU is present, `gl` will exit with instructions; present the choice to the user before proceeding.

## 3. Creating a new branch (optional)

To work on a new branch without manual git:

```sh
gl pin add my_branch github.com/owner/knowledge --ref main --branch my_branch
```

If the branch does not exist on the remote, gl creates it automatically on the first write (add, reconcile). Use `--ref` to branch from main, a tag, or another ref.

See `02-verification.md` for verification steps.
