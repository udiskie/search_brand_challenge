import { setTimeout as delay } from "node:timers/promises";
import { pagesDir, urlHash, writeJson, writeText } from "./datalake";
import type { RobotsChecker } from "./robots";
import type { CrawledPage, PageMeta, ScrapeConfig } from "./types";
import path from "node:path";

export type CrawlerConfig = Pick<
  ScrapeConfig,
  "concurrency" | "requestDelayMs" | "timeoutMs" | "maxRetries" | "userAgent"
>;

function backoffMs(attempt: number): number {
  return 300 * 2 ** attempt;
}

export async function fetchPageWithRetries(
  url: string,
  config: Pick<CrawlerConfig, "timeoutMs" | "maxRetries" | "userAgent">,
  fetchImpl: typeof fetch = fetch
): Promise<{ html: string; meta: PageMeta }> {
  const hash = urlHash(url);
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const res = await fetchImpl(url, {
        headers: { "user-agent": config.userAgent },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status >= 500 && attempt < config.maxRetries) {
        lastError = `HTTP ${res.status}`;
        await delay(backoffMs(attempt));
        continue;
      }

      const html = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        html,
        meta: {
          url,
          urlHash: hash,
          status: res.status,
          headers,
          fetchedAt: new Date().toISOString(),
          error: res.ok ? undefined : `HTTP ${res.status}`,
        },
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < config.maxRetries) {
        await delay(backoffMs(attempt));
        continue;
      }
    }
  }

  return {
    html: "",
    meta: {
      url,
      urlHash: hash,
      status: null,
      headers: {},
      fetchedAt: new Date().toISOString(),
      error: lastError ?? "unknown error",
    },
  };
}

/**
 * Crawls the given URLs with bounded concurrency and a per-worker delay
 * between requests (a simple, good-enough politeness mechanism for a
 * marketing-site-sized crawl). URLs disallowed by robots.txt are skipped
 * entirely rather than fetched and discarded.
 */
export async function crawlPages(
  urls: string[],
  robots: RobotsChecker,
  config: CrawlerConfig,
  fetchImpl: typeof fetch = fetch
): Promise<CrawledPage[]> {
  const allowed = urls.filter((url) => {
    try {
      return robots.isAllowed(new URL(url).pathname);
    } catch {
      return false;
    }
  });

  const results: CrawledPage[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < allowed.length) {
      const current = nextIndex++;
      if (current > 0) await delay(config.requestDelayMs);
      const url = allowed[current];
      const { html, meta } = await fetchPageWithRetries(url, config, fetchImpl);
      results.push({ url, urlHash: meta.urlHash, html, meta });
    }
  }

  const workerCount = Math.max(1, Math.min(config.concurrency, allowed.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}

/** Persists one crawled page's raw HTML + metadata under datalake/{product}/raw/pages/. */
export async function persistCrawledPage(
  product: string,
  page: CrawledPage
): Promise<void> {
  const dir = pagesDir(product);
  await writeText(path.join(dir, `${page.urlHash}.html`), page.html);
  await writeJson(path.join(dir, `${page.urlHash}.meta.json`), page.meta);
}
