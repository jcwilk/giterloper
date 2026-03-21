/**
 * Branch operations: requirePinBranch, assertBranchReadyForWrite, ensureWorkingClone,
 * assertBranchFresh, branchFreshSoft, eagerPushBranchOrFail.
 */
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

import { BranchShaMismatchError, EXIT, fail } from "./errors.ts";
import { retryLogFromGlState, runGitNetwork } from "./retry-external.ts";
import { run, runSoft } from "./run.ts";
import { isBranchNotFoundError } from "./run.ts";
import { resolveBranchShaReachable, setCloneIdentity, toRemoteUrl } from "./git.ts";
import { cloneDir, ensureDir, stagedDir } from "./paths.ts";
import type { GlState, Pin, RetryLogContext } from "./types.ts";

export function requirePinBranch(pin: Pin, operation: string): void {
  if (pin.branch) return;
  fail(
    `pin "${pin.name}" has no branch. ${operation} requires a branched pin. Add one with "gl pin add ${pin.name} ${pin.source} --branch <branch>".`,
    EXIT.USER
  );
}

/**
 * Ensures the pin's SHA matches remote branch HEAD (or branch is not on remote yet).
 * Fails with EXIT.EXTERNAL when the remote cannot be reached; allows first push when branch is not on remote.
 */
export function assertBranchReadyForWrite(state: GlState, pin: Pin): void {
  requirePinBranch(pin, "write operation");
  const rlog = retryLogFromGlState(state);
  const { reachable, remoteSha } = resolveBranchShaReachable(pin.source, pin.branch!, rlog);
  if (!reachable) {
    fail(
      `could not reach remote to verify pin vs branch HEAD for pin "${pin.name}" (branch "${pin.branch}"). The remote may be unreachable.`,
      EXIT.EXTERNAL
    );
  }
  if (!remoteSha) return; // branch not on remote yet (e.g. first push)
  if (remoteSha.toLowerCase() === pin.sha.toLowerCase()) return;
  fail(
    [
      `branch "${pin.branch}" exists on remote but pin "${pin.name}" SHA does not match remote HEAD.`,
      `  Pin SHA:     ${pin.sha}`,
      `  Remote HEAD: ${remoteSha}`,
      "  Pin the remote head and investigate under a different named pin:",
      `  gl pin add <new-name> ${pin.source} --ref ${pin.branch}`,
    ].join("\n"),
    EXIT.STATE
  );
}

/**
 * Clone repository to staged directory for a branch.
 * Tries --branch first; if branch not found, clones default and creates branch.
 * Caller must ensure dir does not exist.
 */
export function cloneToStaged(
  state: GlState,
  pin: Pin,
  branch: string,
  opts?: { infoFn?: (msg: string) => void }
): string {
  const dir = stagedDir(state, pin.name, branch);
  ensureDir(path.dirname(dir));
  const url = toRemoteUrl(pin.source);
  const rlog = retryLogFromGlState(state);
  const result = runGitNetwork(
    ["clone", "--depth", "1", "--branch", branch, url, dir],
    {},
    { operation: "git clone --branch", logContext: rlog }
  );
  if (!result.ok) {
    if (isBranchNotFoundError(result)) {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
      (opts?.infoFn ?? (() => {}))(
        `branch "${branch}" not found; creating from default branch`
      );
      const fb = runGitNetwork(["clone", "--depth", "1", url, dir], {}, {
        operation: "git clone default",
        logContext: rlog,
      });
      if (!fb.ok) {
        fail(
          `git clone failed: ${(fb.stderr || fb.stdout).trim()}`,
          EXIT.EXTERNAL
        );
      }
      run("git", ["-C", dir, "checkout", "-b", branch]);
    } else {
      fail(
        `git clone failed: ${(result.stderr || result.stdout).trim()}`,
        EXIT.EXTERNAL
      );
    }
  }
  setCloneIdentity(dir);
  return dir;
}

export function ensureWorkingClone(
  state: GlState,
  pin: Pin,
  opts?: { infoFn?: (msg: string) => void }
): string {
  assertBranchReadyForWrite(state, pin);
  const dir = stagedDir(state, pin.name, pin.branch!);
  if (existsSync(dir)) {
    setCloneIdentity(dir);
    const localSha = run("git", ["-C", dir, "rev-parse", "HEAD"]).trim();
    if (localSha.toLowerCase() !== pin.sha.toLowerCase()) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  if (!existsSync(dir)) {
    cloneToStaged(state, pin, pin.branch!, opts);
  } else {
    setCloneIdentity(dir);
  }
  return dir;
}

export function assertBranchFresh(
  state: GlState,
  pin: Pin,
  workingDir: string
): void {
  if (!pin.branch) return;
  const localSha = run("git", ["-C", workingDir, "rev-parse", "HEAD"]);
  const { reachable, remoteSha } = resolveBranchShaReachable(
    pin.source,
    pin.branch,
    retryLogFromGlState(state)
  );
  if (!reachable) {
    fail(
      `could not reach remote to check branch freshness for pin "${pin.name}" (branch "${pin.branch}"). The remote may be unreachable.`,
      EXIT.EXTERNAL
    );
  }
  if (!remoteSha) return; // branch not on remote yet (e.g. first push)
  if (localSha.toLowerCase() === remoteSha.toLowerCase()) return;
  fail(
    [
      `branch "${pin.branch}" for pin "${pin.name}" is stale.`,
      `  Local HEAD:  ${localSha}`,
      `  Remote HEAD: ${remoteSha}`,
      "  The remote branch has commits not present in your working clone.",
      `  To sync: run "gl pin update ${pin.name}" to pull the latest, then retry.`,
      "  If you have local uncommitted work in the staged clone, you can also run:",
      `    git -C ${stagedDir(state, pin.name, pin.branch)} pull --rebase`,
    ].join("\n"),
    EXIT.STATE
  );
}

export interface BranchFreshResult {
  fresh: boolean | null;
  localSha: string | null;
  remoteSha: string | null;
}

export function commitIfDirty(dir: string, message: string): boolean {
  const status = run("git", ["-C", dir, "status", "--porcelain"]);
  if (!status) return false;
  run("git", ["-C", dir, "add", "-A"]);
  run("git", ["-C", dir, "commit", "-m", message]);
  return true;
}

export function pushBranchOrFail(
  dir: string,
  pin: Pin,
  operationName: string,
  retryLog?: RetryLogContext
): void {
  const pushed = runGitNetwork(["-C", dir, "push", "-u", "origin", pin.branch!], {}, {
    operation: `git push (${operationName})`,
    logContext: retryLog,
  });
  if (pushed.ok) return;
  fail(
    [
      `${operationName} failed while pushing branch "${pin.branch}" for pin "${pin.name}".`,
      "The branch may be stale or diverged on remote.",
      `Git output: ${(pushed.stderr || pushed.stdout || "push failed").trim()}`,
      `Try syncing with "gl pin update ${pin.name}" and retry.`,
    ].join("\n"),
    EXIT.STATE
  );
}

/**
 * Eager branch push when assigning a branch to a pin.
 * - If branch not on remote: push it immediately from the pin's clone.
 * - If branch on remote with different SHA: throw BranchShaMismatchError.
 * Call after clonePin and before/after mutatePins when setting a pin's branch.
 * Caller must ensure clone exists at pin.sha (clonePin already called).
 */
export function eagerPushBranchOrFail(state: GlState, pin: Pin): void {
  requirePinBranch(pin, "eager branch push");
  const rlog = retryLogFromGlState(state);
  const { reachable, remoteSha } = resolveBranchShaReachable(pin.source, pin.branch!, rlog);
  if (!reachable) {
    fail(
      `could not reach remote to push branch for pin "${pin.name}" (branch "${pin.branch}"). The remote may be unreachable.`,
      EXIT.EXTERNAL
    );
  }
  if (remoteSha !== null) {
    if (remoteSha.toLowerCase() !== pin.sha.toLowerCase()) {
      throw new BranchShaMismatchError(
        [
          `branch "${pin.branch}" exists on remote but pin "${pin.name}" SHA does not match remote HEAD.`,
          `  Pin SHA:    ${pin.sha}`,
          `  Remote SHA: ${remoteSha}`,
          "  Pin the remote head and investigate under a different named pin:",
          `  gl pin add <new-name> ${pin.source} --ref ${pin.branch}`,
        ].join("\n"),
        pin.name,
        pin.sha,
        remoteSha,
        pin.branch!
      );
    }
    return; // branch exists and matches; nothing to push
  }
  const dir = cloneDir(state, pin);
  if (!existsSync(dir)) {
    fail(
      `clone for pin "${pin.name}" not found; cannot push branch "${pin.branch}". Ensure pin is cloned first.`,
      EXIT.STATE
    );
  }
  setCloneIdentity(dir);
  run("git", ["-C", dir, "checkout", "-B", pin.branch!]);
  const pushed = runGitNetwork(["-C", dir, "push", "-u", "origin", pin.branch!], {}, {
    operation: "git push (eager)",
    logContext: rlog,
  });
  if (!pushed.ok) {
    fail(
      [
        `eager branch push failed for pin "${pin.name}" (branch "${pin.branch}").`,
        `Git output: ${(pushed.stderr || pushed.stdout || "push failed").trim()}`,
      ].join("\n"),
      EXIT.EXTERNAL
    );
  }
}

export function branchFreshSoft(state: GlState, pin: Pin): BranchFreshResult {
  if (!pin.branch)
    return { fresh: null, localSha: null, remoteSha: null };
  const dir = stagedDir(state, pin.name, pin.branch);
  if (!existsSync(dir))
    return { fresh: null, localSha: null, remoteSha: null };
  const local = runSoft("git", ["-C", dir, "rev-parse", "HEAD"]);
  const remote = runGitNetwork(
    ["ls-remote", "--heads", toRemoteUrl(pin.source), pin.branch],
    {},
    { operation: "git ls-remote (branchFreshSoft)", logContext: retryLogFromGlState(state) }
  );
  if (!local.ok || !remote.ok || !remote.stdout) {
    return { fresh: null, localSha: local.stdout || null, remoteSha: null };
  }
  const remoteSha = remote.stdout.split(/\r?\n/).find(Boolean)?.split(/\s+/)?.[0];
  if (!remoteSha)
    return { fresh: null, localSha: local.stdout || null, remoteSha: null };
  return {
    fresh:
      local.stdout.trim().toLowerCase() === remoteSha.trim().toLowerCase(),
    localSha: local.stdout.trim(),
    remoteSha: remoteSha.trim(),
  };
}
