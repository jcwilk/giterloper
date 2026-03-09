/**
 * Pure functions for reconcile operations: safe names, queue filenames, search parsing.
 */
import { createHash } from "node:crypto";
export function safeName(input) {
    const cleaned = String(input || "")
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return cleaned || "entry";
}
export function makeQueueFilename(content, nameArg) {
    if (nameArg) {
        const base = safeName(nameArg);
        return base.toLowerCase().endsWith(".md") ? base : `${base}.md`;
    }
    return `${createHash("sha256").update(content).digest("hex").slice(0, 12)}.md`;
}
export function parseSearchJson(text) {
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
export function normalizeKnowledgeRelPath(pathFromSearch) {
    const p = String(pathFromSearch || "").replace(/^\/+/, "");
    if (!p)
        return null;
    return p.startsWith("knowledge/") ? p.slice("knowledge/".length) : p;
}
export function chooseMatchedKnowledgePath(results) {
    for (const r of results) {
        const candidate = r?.path || r?.filepath || r?.file || r?.docPath || r?.docpath;
        if (candidate)
            return normalizeKnowledgeRelPath(candidate);
    }
    return null;
}
