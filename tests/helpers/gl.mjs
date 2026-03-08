import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GL_SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".cursor",
  "skills",
  "gl",
  "scripts",
  "gl.mjs"
);

function normalizeOutput(stdout, parseJson) {
  if (!stdout) return null;
  const text = stdout.trim();
  if (!parseJson) return text;

  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
}

export function runGl(args, { parseJson = true, cwd = process.cwd() } = {}) {
  const cliArgs = ["--json", ...args];
  const result = spawnSync("node", [GL_SCRIPT, ...cliArgs], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
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
    status: result.status,
    stdout,
    stderr,
    data: normalizeOutput(stdout, parseJson),
  };
}

export function runGlJson(args, { cwd = process.cwd() } = {}) {
  return runGl(args, { parseJson: true, cwd }).data;
}
