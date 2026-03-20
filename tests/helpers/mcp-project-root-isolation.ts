/**
 * Isolate MCP integration tests from repo-root `.giterloper/` (parallel harness + shared clones).
 * Matches tests/README.md guidance for GITERLOPER_PROJECT_ROOT.
 */
export async function withIsolatedGiterloperProjectRoot<T>(fn: () => Promise<T>): Promise<T> {
  const tmp = Deno.makeTempDirSync();
  const prev = Deno.env.get("GITERLOPER_PROJECT_ROOT");
  Deno.env.set("GITERLOPER_PROJECT_ROOT", tmp);
  try {
    return await fn();
  } finally {
    if (prev === undefined) Deno.env.delete("GITERLOPER_PROJECT_ROOT");
    else Deno.env.set("GITERLOPER_PROJECT_ROOT", prev);
    try {
      Deno.removeSync(tmp, { recursive: true });
    } catch {
      /* ignore */
    }
  }
}
