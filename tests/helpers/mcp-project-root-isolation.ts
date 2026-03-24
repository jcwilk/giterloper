/**
 * Isolate MCP integration tests from repo-root `.giterloper/` (parallel harness + shared clones).
 * Matches tests/README.md guidance for GITERLOPER_PROJECT_ROOT.
 *
 * `GITERLOPER_PROJECT_ROOT` is process-global; parallel tests must not set it concurrently.
 */
let projectRootIsolationTail: Promise<void> = Promise.resolve();

export async function withIsolatedGiterloperProjectRoot<T>(fn: () => Promise<T>): Promise<T> {
  const prev = projectRootIsolationTail;
  let done!: () => void;
  projectRootIsolationTail = new Promise<void>((resolve) => {
    done = resolve;
  });
  await prev;
  try {
    const tmp = Deno.makeTempDirSync();
    const prevEnv = Deno.env.get("GITERLOPER_PROJECT_ROOT");
    Deno.env.set("GITERLOPER_PROJECT_ROOT", tmp);
    try {
      return await fn();
    } finally {
      if (prevEnv === undefined) Deno.env.delete("GITERLOPER_PROJECT_ROOT");
      else Deno.env.set("GITERLOPER_PROJECT_ROOT", prevEnv);
      try {
        Deno.removeSync(tmp, { recursive: true });
      } catch {
        /* ignore */
      }
    }
  } finally {
    done();
  }
}
