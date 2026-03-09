/**
 * Pinned.yaml parsing, serialization, and state management.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { EXIT } from "./errors.js";
import { fail } from "./errors.js";
import { withFifoLock } from "./locking.js";
export function parsePinned(content) {
    const pins = [];
    let current = null;
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, "  ");
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const indent = line.match(/^ */)?.[0]?.length ?? 0;
        const colon = trimmed.indexOf(":");
        if (colon < 0)
            continue;
        if (indent === 0) {
            const name = trimmed.slice(0, colon).trim();
            const value = trimmed.slice(colon + 1).trim();
            if (!name)
                fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
            // Backward-compatible with legacy "name: source@sha" one-liner format.
            if (value) {
                const at = value.lastIndexOf("@");
                if (at < 0)
                    fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
                const source = value.slice(0, at).trim();
                const sha = value.slice(at + 1).trim();
                if (!source || !/^[0-9a-f]{40}$/i.test(sha)) {
                    fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
                }
                pins.push({ name, source, sha });
                current = null;
                continue;
            }
            current = { name, source: null, sha: null, branch: undefined };
            pins.push(current);
            continue;
        }
        if (!current)
            fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
        const key = trimmed.slice(0, colon).trim();
        const value = trimmed.slice(colon + 1).trim();
        if (!value)
            fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
        if (key === "repo")
            current.source = value;
        if (key === "sha")
            current.sha = value;
        if (key === "branch")
            current.branch = value;
    }
    for (const pin of pins) {
        if (!pin.source || !/^[0-9a-f]{40}$/i.test(pin.sha || "")) {
            fail(`invalid pinned.yaml entry for "${pin.name}"`, EXIT.STATE);
        }
    }
    return pins;
}
export function serializePins(pins) {
    const body = pins
        .map((pin) => {
        const lines = [`${pin.name}:`, `  repo: ${pin.source}`, `  sha: ${pin.sha}`];
        if (pin.branch)
            lines.push(`  branch: ${pin.branch}`);
        return lines.join("\n");
    })
        .join("\n");
    return `${body}${body ? "\n" : ""}`;
}
export function ensureGiterloperRoot(state) {
    if (!existsSync(state.rootDir)) {
        fail(`missing ${state.rootDir}. Ensure .giterloper/ and pinned.yaml exist.`, EXIT.STATE);
    }
    if (!existsSync(state.pinnedPath)) {
        fail(`missing ${state.pinnedPath}. Add pins via "gl pin add" then run "gl clone" and "gl index".`, EXIT.STATE);
    }
}
export function readPins(state) {
    ensureGiterloperRoot(state);
    const content = readFileSync(state.pinnedPath, "utf8");
    return parsePinned(content);
}
export function mutatePins(state, mutator) {
    const lockDir = `${state.rootDir}/locks/pins`;
    withFifoLock(lockDir, () => {
        const content = readFileSync(state.pinnedPath, "utf8");
        const pins = parsePinned(content);
        const updated = mutator(pins);
        const temp = `${state.pinnedPath}.tmp`;
        writeFileSync(temp, serializePins(updated), "utf8");
        renameSync(temp, state.pinnedPath);
    }, { maxWaitMs: 5000 });
}
export function writePinsAtomic(state, pins) {
    const temp = `${state.pinnedPath}.tmp`;
    writeFileSync(temp, serializePins(pins), "utf8");
    renameSync(temp, state.pinnedPath);
}
export function resolvePin(state, pinName) {
    const pins = readPins(state);
    if (pins.length === 0)
        fail("no pins configured in .giterloper/pinned.yaml", EXIT.STATE);
    if (!pinName)
        return pins[0];
    const pin = pins.find((p) => p.name === pinName);
    if (!pin)
        fail(`pin "${pinName}" not found`, EXIT.USER);
    return pin;
}
