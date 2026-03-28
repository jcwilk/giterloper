import { assertEquals } from "jsr:@std/assert";
import { existsSync } from "node:fs";
import path from "node:path";

import { reconcileContextQueryFromPending } from "../../lib/reconcile-context.ts";
import { integrateCorpusWithOpenAi } from "../../lib/reconcile-llm.ts";
import {
  buildCorpusDeterministicIntegrate,
  collectH2Keys,
  decomposePendingEntry,
  extractTopic,
  normalizeHeading,
  reconcile,
  sequencePendingByPaperTrail,
  splitPreambleAndH2,
  splitTwoWays,
  stripBoilerplate,
  stripH2SectionsMatching,
  violatesSingleTopicFileShortcut,
  type PendingEntry,
} from "../../lib/reconcile.ts";
import { run } from "../../lib/run.ts";

Deno.test("reconcileContextQueryFromPending derives query from first pending body line", () => {
  assertEquals(
    reconcileContextQueryFromPending([
      { path: "knowledge/_pending/x.md", content: "# Title Here\n\nBody paragraph." },
    ]),
    "Title Here",
  );
});

Deno.test("extractTopic uses first # heading", () => {
  assertEquals(extractTopic("# Foo Bar\n\nbody", "x.md"), "foo-bar");
  assertEquals(extractTopic("# API Design\ncontent", "a.md"), "api-design");
});

Deno.test("extractTopic falls back to filename stem when no heading", () => {
  assertEquals(extractTopic("plain text", "my-topic.md"), "my-topic");
  assertEquals(extractTopic("", "fallback.md"), "fallback");
});

Deno.test("extractTopic sanitizes for filename", () => {
  assertEquals(extractTopic("# Foo: Bar! (v1)", "x.md"), "foo-bar-v1");
});

Deno.test("stripBoilerplate collapses multiple newlines", () => {
  assertEquals(stripBoilerplate("a\n\n\n\nb"), "a\n\nb");
  assertEquals(stripBoilerplate("x\n\n\ny\n\nz"), "x\n\ny\n\nz");
});

Deno.test("splitPreambleAndH2 separates intro and H2 sections", () => {
  const { preamble, h2sections } = splitPreambleAndH2("# T\n\nintro\n\n## A\n\na\n\n## B\n\nb");
  assertEquals(preamble.includes("# T"), true);
  assertEquals(h2sections.length, 2);
  assertEquals(h2sections[0].title, "A");
  assertEquals(h2sections[1].title, "B");
});

Deno.test("decomposePendingEntry yields at least two corpus paths", () => {
  const entry: PendingEntry = {
    path: "knowledge/_pending/x.md",
    content: "# One Topic\n\nOnly body no H2.",
  };
  const chunks = decomposePendingEntry(entry);
  assertEquals(chunks.length >= 2, true);
  assertEquals(chunks[0].relPath.startsWith("knowledge/one-topic/"), true);
  assertEquals(chunks[0].pendingBasename, "x.md");
});

Deno.test("decomposePendingEntry splits multiple H2 into multiple files", () => {
  const entry: PendingEntry = {
    path: "knowledge/_pending/y.md",
    content: "# T\n\n## First\n\na\n\n## Second\n\nb",
  };
  const chunks = decomposePendingEntry(entry);
  assertEquals(chunks.length, 2);
  assertEquals(chunks.every((c) => c.relPath.includes("knowledge/t/")), true);
});

Deno.test("stripH2SectionsMatching removes H2 keys present in set", () => {
  const keys = new Set([normalizeHeading("Status")]);
  const md = "# X\n\n## Status\n\nold\n\n## Other\n\nkeep";
  const out = stripH2SectionsMatching(md, keys);
  assertEquals(out.includes("old"), false);
  assertEquals(out.includes("keep"), true);
});

Deno.test("collectH2Keys lists normalized headings", () => {
  assertEquals(collectH2Keys("## Foo Bar\n\nx"), [normalizeHeading("Foo Bar")]);
});

Deno.test("splitTwoWays splits at paragraph boundary", () => {
  const [a, b] = splitTwoWays("line1\n\nline2");
  assertEquals(a.includes("line1"), true);
  assertEquals(b.includes("line2"), true);
});

Deno.test("sequencePendingByPaperTrail orders by git first-add time (not lexicographic basename)", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "reconcile-paper-" });
  try {
    run("git", ["-C", tmp, "init"]);
    run("git", ["-C", tmp, "config", "user.email", "t@test"]);
    run("git", ["-C", tmp, "config", "user.name", "t"]);
    const pendingDir = `${tmp}/knowledge/_pending`;
    Deno.mkdirSync(pendingDir, { recursive: true });
    Deno.writeTextFileSync(`${pendingDir}/z-later-alpha.md`, "# Z\n\nfirst commit");
    run("git", ["-C", tmp, "add", "-A"]);
    run("git", ["-C", tmp, "commit", "-m", "add z"], {
      env: {
        ...Deno.env.toObject(),
        GIT_AUTHOR_DATE: "2020-01-01T12:00:00",
        GIT_COMMITTER_DATE: "2020-01-01T12:00:00",
      },
    });
    Deno.writeTextFileSync(`${pendingDir}/a-earlier-beta.md`, "# A\n\nsecond commit");
    run("git", ["-C", tmp, "add", "-A"]);
    run("git", ["-C", tmp, "commit", "-m", "add a"], {
      env: {
        ...Deno.env.toObject(),
        GIT_AUTHOR_DATE: "2020-01-01T15:00:00",
        GIT_COMMITTER_DATE: "2020-01-01T15:00:00",
      },
    });
    const entries = await sequencePendingByPaperTrail(tmp);
    assertEquals(
      entries.map((e) => e.path.replace(/^knowledge\/_pending\//, "")),
      ["z-later-alpha.md", "a-earlier-beta.md"],
    );
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

Deno.test("violatesSingleTopicFileShortcut detects single knowledge/<topic>.md integration", () => {
  const entry: PendingEntry = {
    path: "knowledge/_pending/x.md",
    content: "# My Topic\n\nbody",
  };
  const topic = extractTopic(entry.content, "x.md");
  const bad = new Map<string, string>([
    [`knowledge/${topic}.md`, `text\n\n## Sources\n\n- \`x.md\`\n`],
  ]);
  assertEquals(violatesSingleTopicFileShortcut(entry, bad), true);

  const good = new Map<string, string>([
    [`knowledge/${topic}/part-a.md`, "## A\n\n## Sources\n\n- \`x.md\`\n"],
    [`knowledge/${topic}/part-b.md`, "## B\n\n## Sources\n\n- \`x.md\`\n"],
  ]);
  assertEquals(violatesSingleTopicFileShortcut(entry, good), false);
});

Deno.test("reconcile runs retrieveCorpusContext before integrationOverride and passes snippets", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "reconcile-ctx-seam-" });
  try {
    run("git", ["-C", tmp, "init"]);
    run("git", ["-C", tmp, "config", "user.email", "t@test"]);
    run("git", ["-C", tmp, "config", "user.name", "t"]);
    const pendingDir = `${tmp}/knowledge/_pending`;
    Deno.mkdirSync(pendingDir, { recursive: true });
    Deno.writeTextFileSync(`${pendingDir}/p.md`, "# T\n\nbody");
    run("git", ["-C", tmp, "add", "-A"]);
    run("git", ["-C", tmp, "commit", "-m", "init"]);
    const order: string[] = [];
    const r = await reconcile(tmp, {
      retrieveCorpusContext: async () => {
        order.push("ctx");
        return [{ path: "knowledge/corpus.md", snippet: "search hint for integration" }];
      },
      integrationOverride: async (_dir, _entries, _corpusBefore, snippets) => {
        order.push("llm");
        assertEquals(snippets?.length, 1);
        assertEquals(snippets?.[0].snippet, "search hint for integration");
        const next = new Map<string, string>();
        next.set("knowledge/t/p-part-01.md", "## A\n\n## Sources\n\n- `p.md`\n");
        next.set("knowledge/t/p-part-02.md", "## B\n\n## Sources\n\n- `p.md`\n");
        return { ok: true, corpus: next };
      },
    });
    assertEquals(order, ["ctx", "llm"]);
    assertEquals(r.ok, true);
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

Deno.test("reconcile returns failure when LLM integration reports ok: false (no bogus success)", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "reconcile-llm-fail-" });
  try {
    run("git", ["-C", tmp, "init"]);
    run("git", ["-C", tmp, "config", "user.email", "t@test"]);
    run("git", ["-C", tmp, "config", "user.name", "t"]);
    const pendingDir = `${tmp}/knowledge/_pending`;
    Deno.mkdirSync(pendingDir, { recursive: true });
    Deno.writeTextFileSync(`${pendingDir}/p.md`, "# T\n\nbody");
    run("git", ["-C", tmp, "add", "-A"]);
    run("git", ["-C", tmp, "commit", "-m", "init"]);
    const r = await reconcile(tmp, {
      integrationOverride: async () => ({ ok: false, message: "simulated LLM failure" }),
    });
    assertEquals(r.ok, false);
    if (r.ok) return;
    assertEquals(r.message.includes("simulated LLM failure"), true);
    assertEquals(existsSync(`${pendingDir}/p.md`), true);
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

Deno.test("reconcile integrates one pending per LLM pass until queue empty (multi-pending)", async () => {
  const tmp = Deno.makeTempDirSync({ prefix: "reconcile-multi-" });
  try {
    run("git", ["-C", tmp, "init"]);
    run("git", ["-C", tmp, "config", "user.email", "t@test"]);
    run("git", ["-C", tmp, "config", "user.name", "t"]);
    const pendingDir = `${tmp}/knowledge/_pending`;
    Deno.mkdirSync(pendingDir, { recursive: true });
    Deno.writeTextFileSync(`${pendingDir}/first.md`, "# One\n\nalpha body for split.");
    run("git", ["-C", tmp, "add", "-A"]);
    run("git", ["-C", tmp, "commit", "-m", "first"], {
      env: {
        ...Deno.env.toObject(),
        GIT_AUTHOR_DATE: "2020-01-01T12:00:00",
        GIT_COMMITTER_DATE: "2020-01-01T12:00:00",
      },
    });
    Deno.writeTextFileSync(`${pendingDir}/second.md`, "# Two\n\nbeta body for split.");
    run("git", ["-C", tmp, "add", "-A"]);
    run("git", ["-C", tmp, "commit", "-m", "second"], {
      env: {
        ...Deno.env.toObject(),
        GIT_AUTHOR_DATE: "2020-01-01T15:00:00",
        GIT_COMMITTER_DATE: "2020-01-01T15:00:00",
      },
    });
    let pass = 0;
    const r = await reconcile(tmp, {
      integrationOverride: async (_dir, entries, corpusBefore) => {
        pass++;
        assertEquals(entries.length, 1);
        const base = path.basename(entries[0].path);
        const topic = base === "first.md" ? "one" : "two";
        const a = `knowledge/${topic}/${base.replace(".md", "")}-part-01.md`;
        const b = `knowledge/${topic}/${base.replace(".md", "")}-part-02.md`;
        const next = new Map(corpusBefore);
        next.set(a, `# A\n\nfrom ${base}\n\n## Sources\n\n- \`${base}\`\n`);
        next.set(b, `# B\n\nmore ${base}\n\n## Sources\n\n- \`${base}\`\n`);
        return { ok: true, corpus: next };
      },
    });
    assertEquals(pass, 2);
    assertEquals(r.ok, true);
    if (!r.ok) return;
    assertEquals(r.deleted?.length, 2);
    assertEquals(r.deleted?.includes("knowledge/_pending/first.md"), true);
    assertEquals(r.deleted?.includes("knowledge/_pending/second.md"), true);
    assertEquals(existsSync(`${pendingDir}/first.md`), false);
    assertEquals(existsSync(`${pendingDir}/second.md`), false);
    assertEquals(r.touched?.some((p) => p.includes("first-part")), true);
    assertEquals(r.touched?.some((p) => p.includes("second-part")), true);
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});

Deno.test("integrateCorpusWithOpenAi does not succeed without API key", async () => {
  const oldOpen = Deno.env.get("OPENAI_API_KEY");
  const oldDedicated = Deno.env.get("GITERLOPER_RECONCILE_OPENAI_API_KEY");
  try {
    Deno.env.delete("OPENAI_API_KEY");
    Deno.env.delete("GITERLOPER_RECONCILE_OPENAI_API_KEY");
    const r = await integrateCorpusWithOpenAi(
      [{ path: "knowledge/_pending/x.md", content: "# A\n\nb" }],
      new Map(),
    );
    assertEquals(r.ok, false);
    if (r.ok) return;
    assertEquals(r.message.includes("API key"), true);
  } finally {
    if (oldOpen !== undefined) Deno.env.set("OPENAI_API_KEY", oldOpen);
    else Deno.env.delete("OPENAI_API_KEY");
    if (oldDedicated !== undefined) {
      Deno.env.set("GITERLOPER_RECONCILE_OPENAI_API_KEY", oldDedicated);
    } else Deno.env.delete("GITERLOPER_RECONCILE_OPENAI_API_KEY");
  }
});

/** Unit-test helper `buildCorpusDeterministicIntegrate` (not used by `reconcile()`). */
Deno.test("buildCorpusDeterministicIntegrate (unit helper) produces multi-file corpus with Sources", () => {
  const tmp = Deno.makeTempDirSync({ prefix: "reconcile-det-" });
  try {
    const pendingDir = `${tmp}/knowledge/_pending`;
    Deno.mkdirSync(pendingDir, { recursive: true });
    Deno.writeTextFileSync(
      `${pendingDir}/p.md`,
      "# Doc Title Here\n\npara one\n\npara two for split.\n",
    );
    const entries: PendingEntry[] = [
      {
        path: "knowledge/_pending/p.md",
        content: Deno.readTextFileSync(`${pendingDir}/p.md`),
      },
    ];
    const r = buildCorpusDeterministicIntegrate(tmp, entries);
    assertEquals(r.ok, true);
    if (!r.ok) return;
    assertEquals(r.corpus.size >= 2, true);
    const union = [...r.corpus.values()].join("\n");
    assertEquals(union.includes("## Sources"), true);
    assertEquals(union.includes("`p.md`"), true);
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});
