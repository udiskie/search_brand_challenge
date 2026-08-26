import { tokenize } from "../scraper/extractors/text";
import type { TagcloudTerm } from "../scraper/types";
import type { CrossValidationGap, ParsedRun } from "./types";

/**
 * Compares the brand's own site tagcloud (from the scraper's
 * extracted/tagcloud.json) against the vocabulary Gemini actually uses
 * when it mentions the brand. A top site keyword the model never uses is
 * a GEO gap: the site says it, but the model isn't picking it up as a
 * defining trait -- even when AEO share of voice for the brand is fine.
 */
export function findGeoAeoGaps(
  siteTagcloud: TagcloudTerm[],
  runs: ParsedRun[],
  brand: string,
  topN = 30
): CrossValidationGap[] {
  const modelVocabulary = new Set<string>();
  for (const run of runs) {
    const mention = run.mentions.find((m) => m.brand === brand);
    if (!mention) continue;
    for (const token of tokenize(mention.context)) modelVocabulary.add(token);
  }

  return siteTagcloud.slice(0, topN).map((term) => ({
    term: term.term,
    siteScore: term.score,
    mentionedByModel: modelVocabulary.has(term.term),
  }));
}
