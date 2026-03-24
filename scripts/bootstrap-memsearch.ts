#!/usr/bin/env -S deno run -A
/**
 * Ensures `memsearch` is on PATH for this process (and subprocesses that inherit env).
 * If missing, creates repo-root `.venv` and runs `pip install memsearch` (PEP 668–safe).
 * See specs/mcp.md (memsearch mandatory at MCP startup); this is harness/ingress only.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function venvBinDir(): string {
  return Deno.build.os === "windows"
    ? path.join(REPO_ROOT, ".venv", "Scripts")
    : path.join(REPO_ROOT, ".venv", "bin");
}

function memsearchExecutable(): string {
  const ext = Deno.build.os === "windows" ? ".exe" : "";
  return path.join(venvBinDir(), `memsearch${ext}`);
}

function pipExecutable(): string {
  const ext = Deno.build.os === "windows" ? ".exe" : "";
  return path.join(venvBinDir(), `pip${ext}`);
}

async function probeMemsearch(pathEnv: string): Promise<boolean> {
  try {
    const r = await new Deno.Command("memsearch", {
      args: ["--help"],
      env: { ...Deno.env.toObject(), PATH: pathEnv },
      stdout: "null",
      stderr: "null",
    }).output();
    return r.success;
  } catch {
    // ENOENT when `memsearch` is not on PATH — not a thrown error for callers.
    return false;
  }
}

async function pathExistsFile(p: string): Promise<boolean> {
  try {
    const s = await Deno.stat(p);
    return s.isFile;
  } catch {
    return false;
  }
}

/** Prepends repo `.venv` bin to PATH when memsearch is not otherwise available. */
export async function ensureMemsearchOnPath(): Promise<void> {
  const cur = Deno.env.get("PATH") ?? "";
  if (await probeMemsearch(cur)) return;

  const vdir = path.join(REPO_ROOT, ".venv");
  const bin = venvBinDir();
  const ms = memsearchExecutable();

  if (!(await pathExistsFile(ms))) {
    const venv = new Deno.Command("python3", {
      args: ["-m", "venv", vdir],
      cwd: REPO_ROOT,
      stdout: "inherit",
      stderr: "inherit",
    });
    const vc = await venv.output();
    if (!vc.success) {
      throw new Error(
        "memsearch is not on PATH and `python3 -m venv .venv` failed. Install Python 3 or add memsearch to PATH.",
      );
    }
    const pip = pipExecutable();
    const inst = new Deno.Command(pip, {
      args: ["install", "-q", "memsearch"],
      cwd: REPO_ROOT,
      stdout: "inherit",
      stderr: "inherit",
    });
    const ic = await inst.output();
    if (!ic.success) {
      throw new Error("pip install memsearch into .venv failed.");
    }
  }

  if (!(await pathExistsFile(ms))) {
    throw new Error("memsearch CLI still missing after bootstrap.");
  }

  const augmented = `${bin}${path.delimiter}${cur}`;
  if (!(await probeMemsearch(augmented))) {
    throw new Error("memsearch not executable after bootstrap (PATH probe failed).");
  }
  Deno.env.set("PATH", augmented);
}
