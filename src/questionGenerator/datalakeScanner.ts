import path from "node:path";
import { extractedDir, geoDir, readJson } from "../scraper/datalake";
import type { GeoSignals, PhraseCloudEntry, StructuredSignals, Tagcloud } from "../scraper/types";
import { containsExcludedTerm } from "./textFilters";
import type { ProductHook } from "./types";

/**
 * Scrape artifacts observed in real crawls (e.g. minified JS variable
 * names or embedded JSON keys that leak into "visible text" extraction --
 * see WORK_PLAN.md/SKILL.md caveats on the scraper's tf-idf tagcloud).
 * Excluded outright rather than left for a human to notice and discard.
 */
export const KNOWN_SCRAPE_ARTIFACTS = new Set([
  "contextreply",
  "americalearn",
  "syncstatus",
]);

const MIN_TAGCLOUD_DOCUMENT_FREQUENCY = 2;
const MIN_TERM_LENGTH = 4;

export interface ScanOptions {
  /** Terms to exclude as hooks even if they pass other filters (typically the brand's own name -- using it as a "hook" to elicit a mention of itself is circular). */
  excludeTerms?: string[];
  maxTagcloudHooks?: number;
}

/**
 * Scans a product's already-scraped data lake (structured_signals.json,
 * geo_signals.json, tagcloud.json, phrase_cloud.json under
 * datalake/{product}/) for evidence-backed "hooks": phrases/keywords the
 * site itself uses to describe its differentiators. Throws if the scraper
 * hasn't been run for this product yet.
 */
export async function scanProductHooks(
  product: string,
  options: ScanOptions = {}
): Promise<ProductHook[]> {
  const exclude = new Set((options.excludeTerms ?? []).map((t) => t.toLowerCase()));
  const maxTagcloudHooks = options.maxTagcloudHooks ?? 20;

  const [signals, geoSignals, tagcloud, phraseCloud] = await Promise.all([
    readJson<StructuredSignals[]>(path.join(extractedDir(product), "structured_signals.json")),
    readJson<GeoSignals[]>(path.join(geoDir(product), "geo_signals.json")),
    readJson<Tagcloud>(path.join(extractedDir(product), "tagcloud.json")),
    readJson<PhraseCloudEntry[]>(path.join(extractedDir(product), "phrase_cloud.json")),
  ]);

  if (!signals || !geoSignals || !tagcloud || !phraseCloud) {
    throw new Error(
      `Missing scraper output for product "${product}" in datalake/${product}/. ` +
        `Run "npm run scrape -- --product ${product} --url <site>" first.`
    );
  }

  const hooks: ProductHook[] = [];

  // 1. Meta descriptions -- the site's own curated, one-sentence pitch per page.
  for (const page of signals) {
    if (!page.metaDescription || page.metaDescription.length < 20) continue;
    if (containsExcludedTerm(page.metaDescription, exclude)) continue;
    hooks.push({
      hook: page.metaDescription,
      source: "meta_description",
      documentFrequency: 1,
      evidence: [{ url: page.url, snippet: page.metaDescription }],
    });
  }

  // 2. GEO self-contained definitions (see extractGeoSignals in the scraper).
  for (const g of geoSignals) {
    const definition = g.entityClarity.definitionSnippet;
    if (!definition || containsExcludedTerm(definition, exclude)) continue;
    hooks.push({
      hook: definition,
      source: "geo_definition",
      documentFrequency: 1,
      evidence: [{ url: g.url, snippet: definition }],
    });
  }

  // 3. Recurring tagcloud terms -- concepts repeated across multiple pages,
  // filtered for scrape artifacts and one-off noise.
  const phraseByTerm = new Map(phraseCloud.map((entry) => [entry.term, entry]));
  const tagcloudHooks = tagcloud.site
    .filter(
      (term) =>
        term.documentFrequency >= MIN_TAGCLOUD_DOCUMENT_FREQUENCY &&
        term.term.length >= MIN_TERM_LENGTH &&
        !KNOWN_SCRAPE_ARTIFACTS.has(term.term) &&
        !exclude.has(term.term)
    )
    .slice(0, maxTagcloudHooks)
    .map((term): ProductHook => ({
      hook: term.term,
      source: "tagcloud",
      documentFrequency: term.documentFrequency,
      evidence: phraseByTerm.get(term.term)?.occurrences.slice(0, 3) ?? [],
    }));

  hooks.push(...tagcloudHooks);

  // A phrase can legitimately repeat across sources (e.g. a site-wide
  // default meta description reused on multiple pages, or the same
  // sentence caught as both a meta description and a GEO definition) --
  // `hook` text is used as the React key downstream, so collapse to one
  // entry per exact phrase, keeping the first (highest-priority source).
  const seen = new Set<string>();
  return hooks.filter((h) => {
    if (seen.has(h.hook)) return false;
    seen.add(h.hook);
    return true;
  });
}
