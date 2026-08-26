import type { Tagcloud, TagcloudTerm } from "../types";
import { countTerms, tokenize } from "./text";

export interface PageText {
  url: string;
  text: string;
}

/**
 * Aggregated tf-idf tagcloud across a product's crawled pages, plus a
 * per-page breakdown. Smoothed idf (`log((N+1)/(df+1)) + 1`) avoids
 * division-by-zero / negative scores on small page counts.
 */
export function buildTagcloud(
  pages: PageText[],
  topN = 50,
  perPageTopN = 10
): Tagcloud {
  const pageTermCounts = pages.map((page) => ({
    url: page.url,
    counts: countTerms(tokenize(page.text)),
  }));

  const documentFrequency = new Map<string, number>();
  for (const { counts } of pageTermCounts) {
    for (const term of counts.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const totalDocs = pages.length || 1;
  const idf = (term: string) =>
    Math.log((totalDocs + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1;

  const aggregateScore = new Map<string, number>();
  for (const { counts } of pageTermCounts) {
    for (const [term, tf] of counts.entries()) {
      aggregateScore.set(term, (aggregateScore.get(term) ?? 0) + tf * idf(term));
    }
  }

  const site: TagcloudTerm[] = [...aggregateScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term, score]) => ({
      term,
      score,
      documentFrequency: documentFrequency.get(term) ?? 0,
    }));

  const byPage: Record<string, { term: string; score: number }[]> = {};
  for (const { url, counts } of pageTermCounts) {
    byPage[url] = [...counts.entries()]
      .map(([term, tf]) => ({ term, score: tf * idf(term) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, perPageTopN);
  }

  return { site, byPage };
}
