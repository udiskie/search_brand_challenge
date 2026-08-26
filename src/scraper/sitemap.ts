import { XMLParser } from "fast-xml-parser";
import type { SitemapEntry } from "./types";

const parser = new XMLParser({ ignoreAttributes: true });

const MAX_SITEMAP_DEPTH = 3;

interface RawUrlEntry {
  loc?: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string | number;
}

interface RawSitemap {
  urlset?: { url?: RawUrlEntry | RawUrlEntry[] };
  sitemapindex?: { sitemap?: RawUrlEntry | RawUrlEntry[] };
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Fetches a sitemap URL and returns the flattened list of page entries,
 * recursively expanding sitemap indexes up to MAX_SITEMAP_DEPTH.
 */
export async function fetchSitemap(
  sitemapUrl: string,
  fetchImpl: typeof fetch = fetch,
  depth = 0
): Promise<SitemapEntry[]> {
  if (depth > MAX_SITEMAP_DEPTH) return [];

  const res = await fetchImpl(sitemapUrl, {
    headers: { "user-agent": "search-brand-datalake-scraper" },
  });
  if (!res.ok) return [];

  const xml = await res.text();
  const parsed = parser.parse(xml) as RawSitemap;

  if (parsed.sitemapindex) {
    const nested = toArray(parsed.sitemapindex.sitemap);
    const results = await Promise.all(
      nested
        .filter((entry) => !!entry.loc)
        .map((entry) => fetchSitemap(entry.loc as string, fetchImpl, depth + 1))
    );
    return results.flat();
  }

  if (parsed.urlset) {
    return toArray(parsed.urlset.url)
      .filter((entry): entry is RawUrlEntry & { loc: string } => !!entry.loc)
      .map((entry) => ({
        loc: entry.loc,
        lastmod: entry.lastmod,
        changefreq: entry.changefreq,
        priority:
          entry.priority !== undefined ? Number(entry.priority) : undefined,
      }));
  }

  return [];
}

/**
 * Resolves the sitemap URL for a site, defaulting to /sitemap.xml.
 */
export function defaultSitemapUrl(siteUrl: string): string {
  const base = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
  return `${base}/sitemap.xml`;
}
