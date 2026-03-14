import { assertEquals, assertRejects } from "jsr:@std/assert";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import type { GlState } from "../../lib/types.ts";
import {
  metadataPath,
  readIndexMetadata,
  writeIndexMetadata,
  type IndexMetadata,
} from "../../lib/memsearch-adapter.ts";
import { ensureDir } from "../../lib/paths.ts";
import { StaleIndexError } from "../../lib/errors.ts";

function makeState(rootDir: string): GlState {
  return {
    projectRoot: path.dirname(rootDir),
    rootDir,
    versionsDir: path.join(rootDir, "versions"),
    stagedRoot: path.join(rootDir, "staged"),
    pinnedPath: path.join(rootDir, "pinned.yaml"),
    globalJson: false,
  };
}

Deno.test("metadataPath returns indexDir/metadata.json", () => {
  const state = makeState("/proj/.giterloper");
  assertEquals(
    metadataPath(state, "p1", "b".repeat(40)),
    "/proj/.giterloper/indexes/p1/" + "b".repeat(40) + "/metadata.json"
  );
});

Deno.test("readIndexMetadata returns null when file missing", () => {
  const root = path.join(tmpdir(), `memsearch-test-${Date.now()}`);
  const state = makeState(root);
  try {
    ensureDir(path.join(root, "indexes", "p", "s".repeat(40)));
    assertEquals(readIndexMetadata(state, "p", "s".repeat(40)), null);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("readIndexMetadata returns null for invalid JSON", () => {
  const root = path.join(tmpdir(), `memsearch-test-${Date.now()}`);
  const state = makeState(root);
  const dir = path.join(root, "indexes", "p", "s".repeat(40));
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "metadata.json"), "{invalid");
    assertEquals(readIndexMetadata(state, "p", "s".repeat(40)), null);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("readIndexMetadata parses valid metadata", () => {
  const root = path.join(tmpdir(), `memsearch-test-${Date.now()}`);
  const state = makeState(root);
  const meta: IndexMetadata = {
    pinName: "kb",
    sha: "c".repeat(40),
    sourcePath: "/clone/path",
    buildFingerprint: "giterloper_v1",
  };
  try {
    const dir = path.join(root, "indexes", "kb", "c".repeat(40));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "metadata.json"), JSON.stringify(meta));
    const read = readIndexMetadata(state, "kb", "c".repeat(40));
    assertEquals(read?.pinName, "kb");
    assertEquals(read?.sha, "c".repeat(40));
    assertEquals(read?.sourcePath, "/clone/path");
    assertEquals(read?.buildFingerprint, "giterloper_v1");
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("writeIndexMetadata then readIndexMetadata roundtrips", () => {
  const root = path.join(tmpdir(), `memsearch-test-${Date.now()}`);
  const state = makeState(root);
  const meta: IndexMetadata = {
    pinName: "test",
    sha: "d".repeat(40),
    sourcePath: "/tmp/clone",
    buildFingerprint: "v1",
  };
  try {
    writeIndexMetadata(state, meta);
    const read = readIndexMetadata(state, "test", "d".repeat(40));
    assertEquals(read?.pinName, meta.pinName);
    assertEquals(read?.sha, meta.sha);
    assertEquals(read?.sourcePath, meta.sourcePath);
    assertEquals(read?.buildFingerprint, meta.buildFingerprint);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("search throws StaleIndexError when metadata pin+sha does not match requested", async () => {
  const root = path.join(tmpdir(), `memsearch-test-${Date.now()}`);
  const state = makeState(root);
  const reqSha = "a".repeat(40);
  const metaSha = "b".repeat(40);
  const dir = path.join(root, "indexes", "pinA", reqSha);
  const meta: IndexMetadata = {
    pinName: "pinB",
    sha: metaSha,
    sourcePath: "/x",
    buildFingerprint: "v1",
  };
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "metadata.json"), JSON.stringify(meta));
    writeFileSync(path.join(dir, "milvus.db"), "");

    const { search } = await import("../../lib/memsearch-adapter.ts");
    const err = (await assertRejects(
      async () => search(state, "pinA", reqSha, "query"),
      StaleIndexError
    )) as StaleIndexError;
    assertEquals(err.message.includes("index metadata mismatch"), true);
    assertEquals(err.pinName, "pinB");
    assertEquals(err.sha, metaSha);
    assertEquals(err.expectedPinName, "pinA");
    assertEquals(err.expectedSha, reqSha);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});
