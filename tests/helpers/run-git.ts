import { runGitNetwork } from "../../lib/retry-external.ts";

export type RunGitOpts = {
  cwd?: string | null;
  /** Upper bound passed through to lib retry (default 8). */
  maxAttempts?: number;
};

/**
 * Run `git` for integration tests. Network subcommands use centralized retries in lib/retry-external.ts.
 */
export function runGit(args: string[], opts: RunGitOpts = {}): string {
  const maxAttempts = opts.maxAttempts ?? 8;
  const cwd = opts.cwd === null || opts.cwd === undefined ? undefined : opts.cwd;
  const result = runGitNetwork(args, { cwd }, {
    operation: `test git ${args[0] ?? ""}`,
    logContext: { role: "test" },
    maxAttempts,
  });
  if (!result.ok) {
    throw new Error((result.stderr || result.stdout || "git command failed").trim());
  }
  return (result.stdout || "").trim();
}
