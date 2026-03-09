/**
 * Process execution: run, runSoft, isBranchNotFoundError.
 */
import { spawnSync } from "node:child_process";
import { EXIT, fail } from "./errors.js";
export { EXIT } from "./errors.js";
export function run(cmd, args, opts = {}) {
    const result = spawnSync(cmd, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        ...opts,
    });
    if (result.error) {
        fail(`failed to run ${cmd}: ${result.error.message}`, EXIT.EXTERNAL);
    }
    if (result.status !== 0) {
        const stderr = String(result.stderr || "").trim();
        const stdout = String(result.stdout || "").trim();
        const details = stderr || stdout || `exit code ${result.status}`;
        fail(`${cmd} ${args.join(" ")} failed: ${details}`, EXIT.EXTERNAL);
    }
    return String(result.stdout || "").trim();
}
export function runSoft(cmd, args, opts = {}) {
    const result = spawnSync(cmd, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        ...opts,
    });
    return {
        ok: !result.error && result.status === 0,
        status: result.status ?? 1,
        stdout: String(result.stdout || "").trim(),
        stderr: String(result.stderr || "").trim(),
        error: result.error,
    };
}
export function isBranchNotFoundError(r) {
    if (r.ok)
        return false;
    const msg = (r.stderr + "\n" + r.stdout).toLowerCase();
    return ((msg.includes("remote branch") && msg.includes("not found")) ||
        msg.includes("could not find remote branch") ||
        (msg.includes("pathspec") && msg.includes("did not match")));
}
