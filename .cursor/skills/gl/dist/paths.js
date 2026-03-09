/**
 * Path utilities: project root, directories, clone/staged paths.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
export function findProjectRoot(startDir = process.cwd()) {
    let current = path.resolve(startDir);
    while (true) {
        if (existsSync(path.join(current, ".git")))
            return current;
        const parent = path.dirname(current);
        if (parent === current)
            return null;
        current = parent;
    }
}
export function ensureDir(dirPath) {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
    }
}
export function cloneDir(state, pin) {
    return path.join(state.versionsDir, pin.name, pin.sha);
}
export function stagedDir(state, pinName, branchName) {
    return path.join(state.stagedRoot, pinName, branchName);
}
