/**
 * Branch operations: requirePinBranch, assertBranchReadyForWrite, ensureWorkingClone,
 * assertBranchFresh, branchFreshSoft.
 */
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { run, runSoft } from "./run.js";
import { isBranchNotFoundError } from "./run.js";
import { EXIT, fail } from "./errors.js";
import { toRemoteUrl, resolveBranchShaSoft, setCloneIdentity } from "./git.js";
import { ensureDir, stagedDir } from "./paths.js";
function log(message) {
    console.error(`gl: ${message}`);
}
export function requirePinBranch(pin, operation) {
    if (pin.branch)
        return;
    fail(`pin "${pin.name}" has no branch. ${operation} requires a branched pin. Add one with "gl pin add ${pin.name} ${pin.source} --branch <branch>".`, EXIT.USER);
}
export function assertBranchReadyForWrite(state, pin) {
    requirePinBranch(pin, "write operation");
    const remoteSha = resolveBranchShaSoft(pin.source, pin.branch);
    if (remoteSha === null)
        return;
    if (remoteSha.toLowerCase() === pin.sha.toLowerCase())
        return;
    fail([
        `branch "${pin.branch}" exists on remote but pin "${pin.name}" SHA does not match remote HEAD.`,
        `  Pin SHA:     ${pin.sha}`,
        `  Remote HEAD: ${remoteSha}`,
        "  Pin the remote head and investigate under a different named pin:",
        `  gl pin add <new-name> ${pin.source} --ref ${pin.branch}`,
    ].join("\n"), EXIT.STATE);
}
export function ensureWorkingClone(state, pin) {
    assertBranchReadyForWrite(state, pin);
    const dir = stagedDir(state, pin.name, pin.branch);
    if (!existsSync(dir)) {
        ensureDir(path.dirname(dir));
        const url = toRemoteUrl(pin.source);
        const result = runSoft("git", ["clone", "--depth", "1", "--branch", pin.branch, url, dir]);
        if (!result.ok) {
            if (isBranchNotFoundError(result)) {
                if (existsSync(dir))
                    rmSync(dir, { recursive: true, force: true });
                log(`branch "${pin.branch}" not found; creating from default branch`);
                run("git", ["clone", "--depth", "1", url, dir]);
                run("git", ["-C", dir, "checkout", "-b", pin.branch]);
            }
            else {
                fail(`git clone failed: ${(result.stderr || result.stdout).trim()}`, EXIT.EXTERNAL);
            }
        }
    }
    setCloneIdentity(dir);
    return dir;
}
export function assertBranchFresh(state, pin, workingDir) {
    if (!pin.branch)
        return;
    const localSha = run("git", ["-C", workingDir, "rev-parse", "HEAD"]);
    const remoteSha = resolveBranchShaSoft(pin.source, pin.branch);
    if (!remoteSha)
        return;
    if (localSha.toLowerCase() === remoteSha.toLowerCase())
        return;
    fail([
        `branch "${pin.branch}" for pin "${pin.name}" is stale.`,
        `  Local HEAD:  ${localSha}`,
        `  Remote HEAD: ${remoteSha}`,
        "  The remote branch has commits not present in your working clone.",
        `  To sync: run "gl pin update ${pin.name}" to pull the latest, then retry.`,
        "  If you have local uncommitted work in the staged clone, you can also run:",
        `    git -C ${stagedDir(state, pin.name, pin.branch)} pull --rebase`,
    ].join("\n"), EXIT.STATE);
}
export function branchFreshSoft(state, pin) {
    if (!pin.branch)
        return { fresh: null, localSha: null, remoteSha: null };
    const dir = stagedDir(state, pin.name, pin.branch);
    if (!existsSync(dir))
        return { fresh: null, localSha: null, remoteSha: null };
    const local = runSoft("git", ["-C", dir, "rev-parse", "HEAD"]);
    const remote = runSoft("git", ["ls-remote", "--heads", toRemoteUrl(pin.source), pin.branch]);
    if (!local.ok || !remote.ok || !remote.stdout) {
        return { fresh: null, localSha: local.stdout || null, remoteSha: null };
    }
    const remoteSha = remote.stdout.split(/\r?\n/).find(Boolean)?.split(/\s+/)?.[0];
    if (!remoteSha)
        return { fresh: null, localSha: local.stdout || null, remoteSha: null };
    return {
        fresh: local.stdout.trim().toLowerCase() === remoteSha.trim().toLowerCase(),
        localSha: local.stdout.trim(),
        remoteSha: remoteSha.trim(),
    };
}
