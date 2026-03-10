import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GL_SCRIPT = path.resolve(__dirname, "..", "..", "lib", "gl.ts");

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

export interface RunGlOptions {
  parseJson?: boolean;
  cwd?: string;
  stdin?: string | null;
}

export function runGl(
  args: string[],
  opts: RunGlOptions = {}
): { status: number | null; stdout: string; stderr: string; data: unknown } {
  const cliArgs = ["--json", ...args];
  const env = { ...Deno.env.toObject() };
  const nvmBin = Deno.env.get("NVM_BIN");
  const extraPath = nvmBin ?? "/usr/local/bin";
  if (env.PATH && !env.PATH.startsWith(extraPath)) {
    env.PATH = `${extraPath}:${env.PATH}`;
  }
  const result = spawnSync(
    "deno",
    ["run", "-A", GL_SCRIPT, ...cliArgs],
    {
      cwd: opts.cwd ?? Deno.cwd(),
      encoding: "utf8",
      input: opts.stdin ?? undefined,
      stdio: ["pipe", "pipe", "pipe"],
      env,
    }
  );

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
    status: result.status,
    stdout,
    stderr,
    data: normalizeOutput(stdout, opts.parseJson ?? true),
  };
}

export function runGlJson(
  args: string[],
  opts: Omit<RunGlOptions, "parseJson"> = {}
): unknown {
  return runGl(args, { ...opts, parseJson: true }).data;
}
