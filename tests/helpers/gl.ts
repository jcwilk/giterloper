import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const GL_SCRIPT = path.join(root, ".cursor", "skills", "gl", "scripts", "gl");

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
  opts: { parseJson?: boolean; cwd?: string; stdin?: string | null; extended?: boolean } = {}
) {
  const parseJson = opts.parseJson ?? true;
  const fullArgs = opts.extended ? ["extended", ...args] : args;
  const cliArgs = ["--json", ...fullArgs];
  const cwd = opts.cwd ?? root;
  // When stdin provided, use temp file + redirect - avoids spawnSync input quirks in Deno test context
  let result;
  if (opts.stdin != null && opts.stdin !== "") {
    const tmp = mkdtempSync(path.join(tmpdir(), "gl-stdin-"));
    const stdinFile = path.join(tmp, "stdin.txt");
    try {
      writeFileSync(stdinFile, opts.stdin, "utf8");
      result = spawnSync("sh", ["-c", `"${GL_SCRIPT}" ${cliArgs.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")} < ${stdinFile}`], {
        cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  } else {
    result = spawnSync(GL_SCRIPT, cliArgs, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  }

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
    data: normalizeOutput(stdout, parseJson),
  };
}

export function runGlJson(
  args: string[],
  opts: { cwd?: string; stdin?: string | null; extended?: boolean } = {}
): unknown {
  return runGl(args, { ...opts, parseJson: true }).data;
}

/** Run extended (debugging) commands: status, clone, index, teardown, stage, stage-cleanup, verify */
export function runGlExtended(args: string[], opts: { cwd?: string; stdin?: string | null } = {}): ReturnType<typeof runGl> {
  return runGl(args, { ...opts, extended: true });
}

/** Run extended commands and parse JSON output */
export function runGlExtendedJson(args: string[], opts: { cwd?: string; stdin?: string | null } = {}): unknown {
  return runGlExtended(args, { ...opts }).data;
}
