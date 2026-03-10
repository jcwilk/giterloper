/**
 * GPU detection and config: detectGpuMode, ensureGpuConfig, printCudaInstallInstructions.
 */
import { EXIT, fail } from "./errors.ts";
import { runSoft } from "./run.ts";
import type { GlState } from "./types.ts";
import { writeLocalConfig } from "./config.ts";

export type GpuDetection =
  | { mode: "cuda" }
  | { mode: "cpu"; reason: "no-toolkit" | "no-gpu" };

export function detectGpuMode(): GpuDetection {
  const nvcc = runSoft("nvcc", ["--version"]);
  if (nvcc.ok) return { mode: "cuda" };
  const nvidiaSmi = runSoft("nvidia-smi", []);
  if (nvidiaSmi.ok) return { mode: "cpu", reason: "no-toolkit" };
  return { mode: "cpu", reason: "no-gpu" };
}

export function printCudaInstallInstructions(infoFn: (msg: string) => void): void {
  infoFn("");
  infoFn("CUDA Toolkit is required for GPU acceleration. Install from:");
  infoFn("  https://developer.nvidia.com/cuda-downloads");
  infoFn("");
  infoFn("Ubuntu/Debian example:");
  infoFn(
    "  wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb"
  );
  infoFn("  sudo dpkg -i cuda-keyring_1.1-1_all.deb");
  infoFn("  sudo apt update && sudo apt install cuda-toolkit-13-1");
  infoFn("");
}

export function ensureGpuConfig(
  state: GlState,
  infoFn: (msg: string) => void
): void {
  if (state.gpuMode === "cuda") return;
  if (state.gpuMode === "cpu") {
    infoFn("GPU disabled. Install CUDA Toolkit and run `gl gpu` to re-detect.");
    return;
  }
  const detected = detectGpuMode();
  if (detected.mode === "cuda") {
    writeLocalConfig(state, { gpuMode: "cuda" });
    state.gpuMode = "cuda";
    return;
  }
  if (detected.reason === "no-gpu") {
    infoFn("No NVIDIA GPU detected; using CPU mode.");
    writeLocalConfig(state, { gpuMode: "cpu" });
    state.gpuMode = "cpu";
    Deno.env.set("NODE_LLAMA_CPP_GPU", "false");
    return;
  }
  printCudaInstallInstructions(infoFn);
  fail(
    "NVIDIA GPU detected but CUDA Toolkit not found. Install CUDA Toolkit and run `gl gpu`, or run `gl gpu --cpu` to continue in CPU-only mode.",
    EXIT.USER
  );
}
