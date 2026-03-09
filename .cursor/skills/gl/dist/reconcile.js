/**
 * Pure, stateless helpers for reconcile and search path handling.
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
        const obj = r;
        if (!obj)
            continue;
        const candidate = obj.path ?? obj.filepath ?? obj.file ?? obj.docPath ?? obj.docpath;
        if (candidate)
            return normalizeKnowledgeRelPath(String(candidate));
    }
    return null;
}
