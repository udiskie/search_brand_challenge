import type { PhraseCloudEntry, TagcloudTerm } from "../types";
import { splitSentences } from "./text";
import type { PageText } from "./tagcloud";

const MAX_SNIPPET_LENGTH = 240;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * For each of the given top tagcloud terms, finds the sentences (across
 * the product's crawled pages) where that term is used in context -- the
 * "phrase cloud" that shows *how* a keyword is actually implemented in
 * copy, not just that it appears.
 */
export function buildPhraseCloud(
  pages: PageText[],
  topTerms: TagcloudTerm[],
  maxSnippetsPerTerm = 5
): PhraseCloudEntry[] {
  const sentencesByPage = pages.map((page) => ({
    url: page.url,
    sentences: splitSentences(page.text),
  }));

  return topTerms.map(({ term }) => {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
    const occurrences: { url: string; snippet: string }[] = [];

    for (const { url, sentences } of sentencesByPage) {
      if (occurrences.length >= maxSnippetsPerTerm) break;
      for (const sentence of sentences) {
        if (occurrences.length >= maxSnippetsPerTerm) break;
        if (pattern.test(sentence)) {
          occurrences.push({
            url,
            snippet:
              sentence.length > MAX_SNIPPET_LENGTH
                ? `${sentence.slice(0, MAX_SNIPPET_LENGTH)}…`
                : sentence,
          });
        }
      }
    }

    return { term, occurrences };
  });
}
