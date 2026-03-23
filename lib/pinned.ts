/**
 * Pinned.yaml I/O: parse, serialize, read, mutate, resolve.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import { EXIT, fail } from "./errors.ts";
import type { GlState } from "./types.ts";
import type { Pin } from "./types.ts";
import { ensureDir } from "./paths.ts";

/** Session pin key; passing this explicitly always fails. Omit pin to refer to session pin. */
export const SESSION_PIN_NAME = "_session";

/**
 * Rejects reserved pin names in user/MCP input. Call for any pin-name-bearing input.
 * Throws with corrective guidance when name is reserved.
 */
export function validatePinName(name: string | null | undefined): void {
  if (!name || typeof name !== "string") return;
  const trimmed = name.trim();
  if (trimmed === SESSION_PIN_NAME) {
    fail(
      `"${SESSION_PIN_NAME}" is a reserved name. Omit the pin argument to use the session pin.`,
      EXIT.USER
    );
  }
}

export function parsePinned(content: string): Pin[] {
  const pins: Pin[] = [];
  let current: Partial<Pin> | null = null;
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.match(/^ */)?.[0]?.length ?? 0;
    const colon = trimmed.indexOf(":");
    if (colon < 0) continue;

    if (indent === 0) {
      const name = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim();
      if (!name) fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);

      if (value) {
        const at = value.lastIndexOf("@");
        if (at < 0) fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
        const source = value.slice(0, at).trim();
        const sha = value.slice(at + 1).trim();
        if (!source || !/^[0-9a-f]{40}$/i.test(sha)) {
          fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
        }
        pins.push({ name, source, sha });
        current = null;
        continue;
      }

      current = { name, source: "", sha: "", branch: undefined };
      pins.push(current as Pin);
      continue;
    }

    if (!current) fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (!value) fail(`invalid pinned.yaml entry: "${rawLine}"`, EXIT.STATE);
    if (key === "repo") current.source = value;
    if (key === "sha") current.sha = value;
    if (key === "branch") current.branch = value;
  }

  for (const pin of pins) {
    if (!pin.source || !/^[0-9a-f]{40}$/i.test(pin.sha || "")) {
      fail(`invalid pinned.yaml entry for "${pin.name}"`, EXIT.STATE);
    }
  }
  return pins;
}

export function serializePins(pins: Pin[]): string {
  const body = pins
    .map((pin) => {
      const lines = [`${pin.name}:`, `  repo: ${pin.source}`, `  sha: ${pin.sha}`];
      if (pin.branch) lines.push(`  branch: ${pin.branch}`);
      return lines.join("\n");
    })
    .join("\n");
  return `${body}${body ? "\n" : ""}`;
}

export function readPins(state: GlState): Pin[] {
  if (!existsSync(state.pinnedPath)) return [];
  ensureGiterloperRoot(state);
  const content = readFileSync(state.pinnedPath, "utf8");
  return parsePinned(content);
}

function doMutatePins(state: GlState, mutator: (pins: Pin[]) => Pin[]): void {
  const pins = existsSync(state.pinnedPath)
    ? parsePinned(readFileSync(state.pinnedPath, "utf8"))
    : [];
  const updated = mutator(pins);
  if (!existsSync(path.dirname(state.pinnedPath))) {
    ensureDir(path.dirname(state.pinnedPath));
  }
  const temp = `${state.pinnedPath}.tmp`;
  writeFileSync(temp, serializePins(updated), "utf8");
  renameSync(temp, state.pinnedPath);
}

/**
 * Mutates pinned.yaml. Each session has its own pinned.yaml; no cross-process contention.
 */
export function mutatePins(state: GlState, mutator: (pins: Pin[]) => Pin[]): void {
  doMutatePins(state, mutator);
}

export function writePinsAtomic(state: GlState, pins: Pin[]): void {
  const temp = `${state.pinnedPath}.tmp`;
  writeFileSync(temp, serializePins(pins), "utf8");
  renameSync(temp, state.pinnedPath);
}

/**
 * Resolves pin by name or session pin. When pinName is omitted/null/undefined,
 * finds the pin named _session. Fails with clear error when no _session exists.
 * Per specs/pin-semantics.md: session pin's name is always _session.
 */
export function resolvePin(state: GlState, pinName: string | null | undefined): Pin {
  validatePinName(pinName);
  const pins = readPins(state);
  const omitPin = !pinName || (typeof pinName === "string" && pinName.trim() === "");
  if (omitPin) {
    const sessionPin = pins.find((p) => p.name === SESSION_PIN_NAME);
    if (!sessionPin) {
      fail(
        `No session pin (${SESSION_PIN_NAME}) configured. For MCP: set KNOWLEDGE_STORE_REMOTE for auto-init. For CLI: ensure ${state.pinnedPath} contains a pin named ${SESSION_PIN_NAME} (gl pin add rejects _session).`,
        EXIT.STATE
      );
    }
    return sessionPin;
  }
  const trimmedName = (pinName as string).trim();
  const pin = pins.find((p) => p.name === trimmedName);
  if (!pin) fail(`pin "${trimmedName}" not found`, EXIT.USER);
  return pin;
}

export function ensureGiterloperRoot(state: GlState): void {
  if (!existsSync(state.rootDir)) {
    fail(`missing ${state.rootDir}. Ensure .giterloper/ exists.`, EXIT.STATE);
  }
}
