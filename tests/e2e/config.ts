export const E2E_MARKER = "gle2e_";
export const TEST_SOURCE = "github.com/jcwilk/giterloper_test_knowledge";

export function toRemoteUrl(source: string): string {
  const token = Deno.env.get("GITERLOPER_GH_TOKEN");
  if (token && source.includes("github.com")) {
    return `https://x-access-token:${token}@${source}`;
  }
  return `https://${source}`;
}

export const TEST_MAIN_REF = "main";
export const CLEAN_MAIN_SHA = "8ff8196117fd5b5ad70a16f1c40df8ed1c760179";
export const TEST_BRANCH = "e2e-topic-branch";
export const TEST_TOPIC_PATH = "knowledge/e2e-topic.md";
export const TEST_TOPIC_TITLE = "Test Topic for E2E";
export const TEST_TOPIC_BODY =
  "This document is added during E2E tests to verify the giterloper gl workflow.\n" +
  "It contains the keyword `e2e-topic-keyword` so search and query paths can confirm retrieval.";
export const TEST_ADD_CONTENT =
  "# Added Queue Topic\n\nThis content is queued with gl add and contains marker `queued-add-marker`.";
export const TEST_SUBTRACT_CONTENT = "queued-add-marker";
