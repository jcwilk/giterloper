/**
 * GPU detection and config.
 */
import { EXIT } from "./errors.js";
import { fail } from "./errors.js";
import { runSoft } from "./run.js";
import { writeLocalConfig } from "./config.js";
function info(message) {
    console.error(`gl: ${message}`);
}
export function detectGpuMode() {
    const nvcc = runSoft("nvcc", ["--version"]);
    if (nvcc.ok)
        return { mode: "cuda" };
    const nvidiaSmi = runSoft("nvidia-smi", []);
    if (nvidiaSmi.ok)
        return { mode: "cpu", reason: "no-toolkit" };
    return { mode: "cpu", reason: "no-gpu" };
}
export function printCudaInstallInstructions() {
    info("");
    info("CUDA Toolkit is required for GPU acceleration. Install from:");
    info("  https://developer.nvidia.com/cuda-downloads");
    info("");
    info("Ubuntu/Debian example:");
    info("  wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb");
    info("  sudo dpkg -i cuda-keyring_1.1-1_all.deb");
    info("  sudo apt update && sudo apt install cuda-toolkit-13-1");
    info("");
}
export function ensureGpuConfig(state) {
    if (state.gpuMode === "cuda")
        return;
    if (state.gpuMode === "cpu") {
        info("GPU disabled. Install CUDA Toolkit and run `gl gpu` to re-detect.");
        return;
    }
    const detected = detectGpuMode();
    if (detected.mode === "cuda") {
        writeLocalConfig(state, { gpuMode: "cuda" });
        state.gpuMode = "cuda";
        return;
    }
    if (detected.reason === "no-gpu") {
        info("No NVIDIA GPU detected; using CPU mode.");
        writeLocalConfig(state, { gpuMode: "cpu" });
        state.gpuMode = "cpu";
        process.env.NODE_LLAMA_CPP_GPU = "false";
        return;
    }
    printCudaInstallInstructions();
    fail("NVIDIA GPU detected but CUDA Toolkit not found. Install CUDA Toolkit and run `gl gpu`, or run `gl gpu --cpu` to continue in CPU-only mode.", EXIT.USER);
}
