import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import type { GlState } from "../../lib/types.ts";
import {
  parsePinned,
  readPins,
  resolvePin,
  serializePins,
  validatePinName,
  mutatePins,
  SESSION_PIN_NAME,
} from "../../lib/pinned.ts";
import { makeState } from "../../lib/gl-core.ts";
import { GlError } from "../../lib/errors.ts";

const SAMPLE_PINS_YAML = `foo:
  repo: github.com/x/repo
  sha: 0123456789abcdef0123456789abcdef01234567
  branch: main
bar: github.com/y/repo@abcdef0123456789abcdef0123456789abcdef01
`;

/** validatePinName accepts _session for MCP client compatibility (resolvePin treats as omitted). */
Deno.test("validatePinName accepts _session", () => {
  validatePinName("_session");
  validatePinName("  _session  ");
});

Deno.test("validatePinName allows non-reserved names", () => {
  validatePinName("foo");
  validatePinName("bar");
  validatePinName(null);
  validatePinName(undefined);
  validatePinName("");
});

const SAMPLE_PINS_WITH_SESSION = `_session:
  repo: github.com/x/repo
  sha: 0123456789abcdef0123456789abcdef01234567
  branch: main
bar: github.com/y/repo@abcdef0123456789abcdef0123456789abcdef01
`;

Deno.test("resolvePin returns _session when pinName omitted", () => {
  const root = path.join(tmpdir(), `pinned-resolve-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "pinned.yaml"), SAMPLE_PINS_WITH_SESSION, "utf8");
  const state: GlState = {
    projectRoot: path.dirname(root),
    rootDir: root,
    versionsDir: path.join(root, "versions"),
    stagedRoot: path.join(root, "staged"),
    pinnedPath: path.join(root, "pinned.yaml"),
    globalJson: false,
  };
  try {
    const pin = resolvePin(state, null);
    assertEquals(pin.name, SESSION_PIN_NAME);
    assertEquals(resolvePin(state, undefined).name, SESSION_PIN_NAME);
    assertEquals(resolvePin(state, "").name, SESSION_PIN_NAME);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("resolvePin fails when no _session exists", () => {
  const root = path.join(tmpdir(), `pinned-resolve-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "pinned.yaml"), SAMPLE_PINS_YAML, "utf8");
  const state: GlState = {
    projectRoot: path.dirname(root),
    rootDir: root,
    versionsDir: path.join(root, "versions"),
    stagedRoot: path.join(root, "staged"),
    pinnedPath: path.join(root, "pinned.yaml"),
    globalJson: false,
  };
  try {
    const err = assertThrows(
      () => resolvePin(state, null),
      GlError
    ) as GlError;
    assertEquals(err.message.includes(SESSION_PIN_NAME), true);
    assertEquals(err.message.includes("KNOWLEDGE_STORE_REMOTE"), true);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("resolvePin returns _session when pinName is _session", () => {
  const root = path.join(tmpdir(), `pinned-resolve-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "pinned.yaml"), SAMPLE_PINS_WITH_SESSION, "utf8");
  const state: GlState = {
    projectRoot: path.dirname(root),
    rootDir: root,
    versionsDir: path.join(root, "versions"),
    stagedRoot: path.join(root, "staged"),
    pinnedPath: path.join(root, "pinned.yaml"),
    globalJson: false,
  };
  try {
    const pin = resolvePin(state, "_session");
    assertEquals(pin.name, SESSION_PIN_NAME);
    assertEquals(pin.branch, "main");
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("readPins returns [] for missing pinned.yaml", () => {
  const root = path.join(tmpdir(), `pinned-read-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  const state: GlState = {
    projectRoot: path.dirname(root),
    rootDir: root,
    versionsDir: path.join(root, "versions"),
    stagedRoot: path.join(root, "staged"),
    pinnedPath: path.join(root, "pinned.yaml"),
    globalJson: false,
  };
  try {
    const pins = readPins(state);
    assertEquals(pins, []);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("mutatePins session-scoped skips lock and updates file", () => {
  const root = path.join(tmpdir(), `pinned-mutate-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "pinned.yaml"), SAMPLE_PINS_YAML, "utf8");
  const state = makeState("pinned-mutate-session");
  // Override paths to use our temp root
  const sessionRoot = path.join(root, "sessions", "pinned-mutate-session");
  mkdirSync(sessionRoot, { recursive: true });
  writeFileSync(path.join(sessionRoot, "pinned.yaml"), SAMPLE_PINS_YAML, "utf8");
  const sessionState: GlState = {
    ...makeState("pinned-mutate-session"),
    rootDir: sessionRoot,
    versionsDir: path.join(sessionRoot, "versions"),
    stagedRoot: path.join(sessionRoot, "staged"),
    pinnedPath: path.join(sessionRoot, "pinned.yaml"),
    sessionId: "pinned-mutate-session",
  };
  try {
    const pinsBefore = readPins(sessionState);
    assertEquals(pinsBefore.length, 2);
    mutatePins(sessionState, (pins) => {
      const updated = pins.filter((p) => p.name !== "bar");
      return updated;
    });
    const pinsAfter = readPins(sessionState);
    assertEquals(pinsAfter.length, 1);
    assertEquals(pinsAfter[0].name, "foo");
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("parsePinned parses nested format", () => {
  const yaml = `foo:
  repo: github.com/x/repo
  sha: 0123456789abcdef0123456789abcdef01234567
  branch: main
`;
  const pins = parsePinned(yaml);
  assertEquals(pins.length, 1);
  assertEquals(pins[0].name, "foo");
  assertEquals(pins[0].source, "github.com/x/repo");
  assertEquals(pins[0].sha, "0123456789abcdef0123456789abcdef01234567");
  assertEquals(pins[0].branch, "main");
});

Deno.test("parsePinned parses legacy one-liner format", () => {
  const yaml = `bar: github.com/y/repo@abcdef0123456789abcdef0123456789abcdef01
`;
  const pins = parsePinned(yaml);
  assertEquals(pins.length, 1);
  assertEquals(pins[0].name, "bar");
  assertEquals(pins[0].source, "github.com/y/repo");
  assertEquals(pins[0].sha, "abcdef0123456789abcdef0123456789abcdef01");
});

Deno.test("parsePinned throws on invalid entry", () => {
  assertThrows(
    () => parsePinned("bad: no-at-symbol"),
    Error,
    "invalid pinned"
  );
});

Deno.test("serializePins roundtrips with parsePinned", () => {
  const pins = [
    { name: "a", source: "github.com/a/r", sha: "a".repeat(40), branch: "main" },
    { name: "b", source: "github.com/b/r", sha: "b".repeat(40) },
  ];
  const out = serializePins(pins);
  const parsed = parsePinned(out);
  assertEquals(parsed.length, pins.length);
  assertEquals(parsed[0].name, pins[0].name);
  assertEquals(parsed[0].source, pins[0].source);
  assertEquals(parsed[0].sha, pins[0].sha);
  assertEquals(parsed[0].branch, pins[0].branch);
  assertEquals(parsed[1].name, pins[1].name);
  assertEquals(parsed[1].source, pins[1].source);
  assertEquals(parsed[1].sha, pins[1].sha);
});

Deno.test("serializePins outputs empty string for empty pins", () => {
  assertEquals(serializePins([]), "");
});
