# Setup

## 1. Ensure prerequisites

1. `git` available: `git --version`
2. Node.js >= 22 (or Bun): `node --version` (or `bun --version`)
3. QMD available: `qmd status`
4. **CUDA Toolkit** (recommended for GPU acceleration):

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
5. Optional: `vulkaninfo --summary` for Vulkan fallback.

## 2. Set up the knowledge store

From the Giterloper project root:

```sh
node .cursor/skills/gl/scripts/gl.mjs setup knowledge github.com/jcwilk/giterloper_knowledge [--ref master]
```

Or, if the pin and clone are already in place (e.g. after clone):

```sh
node .cursor/skills/gl/scripts/gl.mjs index
```

`gl setup` clones the store, detects CUDA/GPU, and runs `qmd embed`. If CUDA is missing but an NVIDIA GPU is present, `gl` will exit with instructions; present the choice to the user before proceeding.

See `02-verification.md` for verification steps.
