/**
 * Spawns the gl CLI via Deno. Used by E2E tests.
 */
import path from "node:path";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const GL_SCRIPT = join(ROOT, "lib", "gl.ts");

function normalizeOutput(stdout: string, parseJson: boolean): unknown {
  if (!stdout) return null;
  const text = stdout.trim();
  if (!parseJson) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function runGl(
  args: string[],
  opts: { parseJson?: boolean; cwd?: string; stdin?: string | null } = {}
): { status: number; stdout: string; stderr: string; data: unknown } {
  const { parseJson = true, cwd = Deno.cwd(), stdin = null } = opts;
  const deno = Deno.env.get("DENO") || "deno";
  const cliArgs = ["run", "-A", GL_SCRIPT, "--json", ...args];
  const result = spawnSync(deno, cliArgs, {
    cwd,
    encoding: "utf8",
    input: stdin ?? undefined,
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.error) {
    throw new Error(`Failed to launch gl: ${result.error.message}`);
  }

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  if (result.status !== 0) {
    const detail = (stderr || stdout || "gl command failed").trim();
    throw new Error(detail);
  }

  return {
    status: result.status ?? 0,
    stdout,
    stderr,
    data: normalizeOutput(stdout, parseJson),
  };
}

export function runGlJson(
  args: string[],
  opts: { cwd?: string; stdin?: string | null } = {}
): unknown {
  return runGl(args, { parseJson: true, ...opts }).data;
}
