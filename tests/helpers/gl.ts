import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const GL_SCRIPT = path.join(root, ".cursor", "skills", "gl", "scripts", "gl");
const GL_EXTENDED_SCRIPT = path.join(root, ".cursor", "skills", "gl", "scripts", "gl-extended");

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

function runGlImpl(
  script: string,
  args: string[],
  opts: { parseJson?: boolean; cwd?: string; stdin?: string | null } = {}
) {
  const parseJson = opts.parseJson ?? true;
  const cliArgs = ["--json", ...args];
  const cwd = opts.cwd ?? root;
  // When stdin provided, use temp file + redirect - avoids spawnSync input quirks in Deno test context
  let result;
  if (opts.stdin != null && opts.stdin !== "") {
    const tmp = mkdtempSync(path.join(tmpdir(), "gl-stdin-"));
    const stdinFile = path.join(tmp, "stdin.txt");
    try {
      writeFileSync(stdinFile, opts.stdin, "utf8");
      result = spawnSync("sh", ["-c", `"${script}" ${cliArgs.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")} < ${stdinFile}`], {
        cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  } else {
    result = spawnSync(script, cliArgs, {
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

export function runGl(
  args: string[],
  opts: { parseJson?: boolean; cwd?: string; stdin?: string | null } = {}
) {
  return runGlImpl(GL_SCRIPT, args, opts);
}

export function runGlExtended(
  args: string[],
  opts: { parseJson?: boolean; cwd?: string; stdin?: string | null } = {}
) {
  return runGlImpl(GL_EXTENDED_SCRIPT, args, opts);
}

export function runGlJson(
  args: string[],
  opts: { cwd?: string; stdin?: string | null } = {}
): unknown {
  return runGl(args, { ...opts, parseJson: true }).data;
}

export function runGlExtendedJson(
  args: string[],
  opts: { cwd?: string; stdin?: string | null } = {}
): unknown {
  return runGlExtended(args, { ...opts, parseJson: true }).data;
}
