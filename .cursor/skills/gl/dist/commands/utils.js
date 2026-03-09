/**
 * Shared helpers for commands.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { run, runSoft } from "../run.js";
import { EXIT, fail } from "../errors.js";
export function ensureGitignoreEntries(state) {
    const ignorePath = path.join(state.projectRoot, ".gitignore");
    const required = [".giterloper/versions/", ".giterloper/staged/", ".giterloper/local.json"];
    let current = "";
    if (existsSync(ignorePath)) {
        current = readFileSync(ignorePath, "utf8");
    }
    const lines = current ? current.split(/\r?\n/) : [];
    let changed = false;
    for (const entry of required) {
        if (!lines.some((line) => line.trim() === entry)) {
            lines.push(entry);
            changed = true;
        }
    }
    if (changed) {
        const cleaned = lines.filter((_, idx, arr) => !(idx === arr.length - 1 && arr[idx] === "")).join("\n");
        writeFileSync(ignorePath, `${cleaned}\n`, "utf8");
    }
}
export function commitIfDirty(dir, message) {
    const status = run("git", ["-C", dir, "status", "--porcelain"]);
    if (!status)
        return false;
    run("git", ["-C", dir, "add", "-A"]);
    run("git", ["-C", dir, "commit", "-m", message]);
    return true;
}
export function pushBranchOrFail(dir, pin, operationName) {
    const pushed = runSoft("git", ["-C", dir, "push", "-u", "origin", pin.branch]);
    if (pushed.ok)
        return;
    fail([
        `${operationName} failed while pushing branch "${pin.branch}" for pin "${pin.name}".`,
        "The branch may be stale or diverged on remote.",
        `Git output: ${(pushed.stderr || pushed.stdout || "push failed").trim()}`,
        `Try syncing with "gl pin update ${pin.name}" and retry.`,
    ].join("\n"), EXIT.STATE);
}
export function readStdinOrFail() {
    const text = readFileSync(0, "utf8");
    if (!text || !text.trim())
        fail("stdin content is required", EXIT.USER);
    return text;
}
