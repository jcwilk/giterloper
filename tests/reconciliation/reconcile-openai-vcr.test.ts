import { assertEquals } from "jsr:@std/assert";

import { integrateCorpusWithOpenAi } from "../../lib/reconcile-llm.ts";
import { getOpenAiVcrMode } from "../../lib/reconcile-openai-vcr.ts";

Deno.test({
  name: "integrateCorpusWithOpenAi: VCR replay/record (GITERLOPER_OPENAI_VCR; harness defaults replay-only)",
  async fn() {
    if (getOpenAiVcrMode() === "off") {
      assertEquals(getOpenAiVcrMode(), "off");
      return;
    }

    const mode = getOpenAiVcrMode();
    const prevKey = Deno.env.get("OPENAI_API_KEY");
    const prevDedicated = Deno.env.get("GITERLOPER_RECONCILE_OPENAI_API_KEY");
    const hadRealKey = Boolean(prevKey?.trim() || prevDedicated?.trim());
    try {
      if (mode === "replay-only") {
        Deno.env.set("OPENAI_API_KEY", "sk-dummy-vcr-replay");
        Deno.env.delete("GITERLOPER_RECONCILE_OPENAI_API_KEY");
      } else if (mode === "record-new" || mode === "rerecord-all") {
        if (!hadRealKey) {
          Deno.env.set("OPENAI_API_KEY", "sk-dummy-vcr-replay");
          Deno.env.delete("GITERLOPER_RECONCILE_OPENAI_API_KEY");
        }
      }

      const result = await integrateCorpusWithOpenAi(
        [{ path: "knowledge/_pending/note.md", addEpoch: 1, content: "# Alpha\n\nHello world." }],
        new Map([["knowledge/existing.md", "# Existing\n\nBody."]]),
      );

      if (!result.ok) {
        throw new Error(result.message);
      }
      assertEquals(result.corpus.size >= 1, true);
      const joined = [...result.corpus.values()].join("\n");
      assertEquals(joined.includes("## Sources"), true);
      assertEquals(/note\.md/.test(joined), true);
    } finally {
      if (prevKey !== undefined) Deno.env.set("OPENAI_API_KEY", prevKey);
      else Deno.env.delete("OPENAI_API_KEY");
      if (prevDedicated !== undefined) {
        Deno.env.set("GITERLOPER_RECONCILE_OPENAI_API_KEY", prevDedicated);
      } else Deno.env.delete("GITERLOPER_RECONCILE_OPENAI_API_KEY");
    }
  },
});
