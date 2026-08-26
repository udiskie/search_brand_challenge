import * as cheerio from "cheerio";
import path from "node:path";
import { crawlPages, persistCrawledPage } from "./crawler";
import { extractedDir, geoDir, rawDir, writeJson, writeText } from "./datalake";
import { extractGeoSignals } from "./extractors/geoSignals";
import { buildPageIndexEntry, classifyPageType } from "./extractors/pagesIndex";
import { buildPhraseCloud } from "./extractors/phraseCloud";
import { extractSeoSignals } from "./extractors/seoSignals";
import { buildTagcloud, type PageText } from "./extractors/tagcloud";
import { extractVisibleText } from "./extractors/text";
import { fetchRobots } from "./robots";
import { defaultSitemapUrl, fetchSitemap } from "./sitemap";
import type {
  CrawledPage,
  GeoSignals,
  PageIndexEntry,
  ScrapeConfig,
  SitemapCoverage,
  SitemapEntry,
  StructuredSignals,
} from "./types";

export interface ScrapeSummary {
  product: string;
  mode: string;
  sitemapCoverage: SitemapCoverage;
  pagesExtracted: number;
}

/**
 * Quick-mode page selection: always include the home page and a handful of
 * pricing/docs/blog pages (the types most likely to move AEO/GEO signals),
 * then fill any remaining budget with the highest sitemap-`priority` pages.
 */
export function selectQuickUrls(
  entries: SitemapEntry[],
  cap: number
): SitemapEntry[] {
  const byType = entries.map((entry) => ({
    entry,
    type: classifyPageType(entry.loc),
  }));

  const take = (type: string, limit: number) =>
    byType.filter((e) => e.type === type).slice(0, limit).map((e) => e.entry);

  const prioritized = [
    ...take("home", 1),
    ...take("pricing", 2),
    ...take("docs", 2),
    ...take("blog", 2),
  ];
  const prioritizedSet = new Set(prioritized);

  const remaining = byType
    .filter((e) => !prioritizedSet.has(e.entry))
    .sort((a, b) => (b.entry.priority ?? 0.5) - (a.entry.priority ?? 0.5))
    .map((e) => e.entry);

  const seen = new Set<string>();
  const combined = [...prioritized, ...remaining].filter((entry) => {
    if (seen.has(entry.loc)) return false;
    seen.add(entry.loc);
    return true;
  });

  return combined.slice(0, cap);
}

export async function runScrape(
  config: ScrapeConfig,
  fetchImpl: typeof fetch = fetch
): Promise<ScrapeSummary> {
  const rootSitemapUrl = defaultSitemapUrl(config.siteUrl);

  const rootSitemapRes = await fetchImpl(rootSitemapUrl, {
    headers: { "user-agent": config.userAgent },
  });
  const rootSitemapText = rootSitemapRes.ok ? await rootSitemapRes.text() : "";
  await writeText(
    path.join(rawDir(config.product), "sitemap.xml"),
    rootSitemapText
  );

  const sitemapEntries = await fetchSitemap(rootSitemapUrl, fetchImpl);
  const selectedEntries =
    config.mode === "quick"
      ? selectQuickUrls(sitemapEntries, config.quickPageCap)
      : sitemapEntries;

  const robots = await fetchRobots(config.siteUrl, fetchImpl);
  const crawledPages = await crawlPages(
    selectedEntries.map((entry) => entry.loc),
    robots,
    config,
    fetchImpl
  );

  await Promise.all(
    crawledPages.map((page) => persistCrawledPage(config.product, page))
  );

  const okPages = crawledPages.filter(
    (page): page is CrawledPage =>
      !!page.html && (page.meta.status ?? 0) < 400
  );

  const seoSignals: StructuredSignals[] = [];
  const geoSignals: GeoSignals[] = [];
  const pageIndex: PageIndexEntry[] = [];
  const pageTexts: PageText[] = [];

  for (const page of okPages) {
    const seo = extractSeoSignals(page.url, page.html);
    seoSignals.push(seo);
    geoSignals.push(extractGeoSignals(page.url, page.html));
    pageIndex.push(buildPageIndexEntry(page.url, page.urlHash, seo.title));
    pageTexts.push({
      url: page.url,
      text: extractVisibleText(cheerio.load(page.html)),
    });
  }

  const tagcloud = buildTagcloud(pageTexts);
  const phraseCloud = buildPhraseCloud(pageTexts, tagcloud.site.slice(0, 30));

  const extracted = extractedDir(config.product);
  await writeJson(path.join(extracted, "pages_index.json"), pageIndex);
  await writeJson(path.join(extracted, "tagcloud.json"), tagcloud);
  await writeJson(path.join(extracted, "phrase_cloud.json"), phraseCloud);
  await writeJson(path.join(extracted, "structured_signals.json"), seoSignals);
  await writeJson(path.join(geoDir(config.product), "geo_signals.json"), geoSignals);

  const brokenUrls = crawledPages
    .filter(
      (page) => page.meta.status === null || (page.meta.status ?? 0) >= 400
    )
    .map((page) => page.url);

  const selectedLocs = new Set(selectedEntries.map((entry) => entry.loc));
  const sitemapCoverage: SitemapCoverage = {
    totalUrls: sitemapEntries.length,
    fetchedUrls: okPages.length,
    brokenUrls,
    skippedUrls:
      config.mode === "quick"
        ? sitemapEntries
            .map((entry) => entry.loc)
            .filter((loc) => !selectedLocs.has(loc))
        : [],
  };
  // Not part of the original WORK_PLAN.md layout sketch, but needed for the
  // "sitemap coverage" part of the SEO report -- lives alongside the other
  // extracted/ artifacts rather than as a one-off top-level file.
  await writeJson(path.join(extracted, "sitemap_coverage.json"), sitemapCoverage);

  return {
    product: config.product,
    mode: config.mode,
    sitemapCoverage,
    pagesExtracted: okPages.length,
  };
}
