import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runScrape, selectQuickUrls } from "./run";
import type { ScrapeConfig, SitemapEntry } from "./types";

describe("selectQuickUrls", () => {
  it("prioritizes home/pricing/docs/blog before filling by sitemap priority", () => {
    const entries: SitemapEntry[] = [
      { loc: "https://example.com/", priority: 0.5 },
      { loc: "https://example.com/careers", priority: 0.9 },
      { loc: "https://example.com/pricing", priority: 0.5 },
      { loc: "https://example.com/blog/post-1", priority: 0.5 },
    ];
    const selected = selectQuickUrls(entries, 3);
    expect(selected.map((e) => e.loc)).toEqual([
      "https://example.com/",
      "https://example.com/pricing",
      "https://example.com/blog/post-1",
    ]);
  });

  it("caps at the requested number of pages", () => {
    const entries: SitemapEntry[] = Array.from({ length: 20 }, (_, i) => ({
      loc: `https://example.com/page-${i}`,
    }));
    expect(selectQuickUrls(entries, 5)).toHaveLength(5);
  });
});

describe("runScrape", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(path.join(tmpdir(), "scraper-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("crawls a small mocked site and writes the datalake artifacts", async () => {
    const sitemapXml = `<urlset>
      <url><loc>https://example.com/</loc><priority>1.0</priority></url>
      <url><loc>https://example.com/pricing</loc></url>
    </urlset>`;
    const homeHtml = `<html><head><title>Example - Home</title>
      <meta name="description" content="Example is the tool for teams that ship fast." />
      </head><body><h1>Welcome to Example</h1><p>Example is fast and simple.</p></body></html>`;
    const pricingHtml = `<html><head><title>Pricing</title></head><body>
      <h1>Pricing</h1><p>Plans start at $10 per month.</p></body></html>`;

    const responses: Record<string, { status: number; body: string }> = {
      "https://example.com/sitemap.xml": { status: 200, body: sitemapXml },
      "https://example.com/robots.txt": { status: 200, body: "" },
      "https://example.com/": { status: 200, body: homeHtml },
      "https://example.com/pricing": { status: 200, body: pricingHtml },
    };

    const fetchImpl = (async (url: string | URL) => {
      const response = responses[url.toString()];
      if (!response) return new Response("not found", { status: 404 });
      return new Response(response.body, { status: response.status });
    }) as typeof fetch;

    const config: ScrapeConfig = {
      product: "example",
      siteUrl: "https://example.com",
      mode: "quick",
      quickPageCap: 15,
      concurrency: 2,
      requestDelayMs: 0,
      timeoutMs: 1000,
      maxRetries: 1,
      userAgent: "test-agent",
    };

    const summary = await runScrape(config, fetchImpl);

    expect(summary.pagesExtracted).toBe(2);
    expect(summary.sitemapCoverage.totalUrls).toBe(2);
    expect(summary.sitemapCoverage.brokenUrls).toEqual([]);

    const readJson = (...parts: string[]) =>
      JSON.parse(readFileSync(path.join(tmpDir, "datalake", ...parts), "utf-8"));

    const pagesIndex = readJson("example", "extracted", "pages_index.json");
    expect(pagesIndex).toHaveLength(2);
    expect(pagesIndex.map((p: { pageType: string }) => p.pageType).sort()).toEqual([
      "home",
      "pricing",
    ]);

    const tagcloud = readJson("example", "extracted", "tagcloud.json");
    expect(tagcloud.site.length).toBeGreaterThan(0);

    const geoSignalsList = readJson("example", "geo", "geo_signals.json");
    expect(geoSignalsList).toHaveLength(2);

    const seoSignalsList = readJson("example", "extracted", "structured_signals.json");
    expect(seoSignalsList).toHaveLength(2);
  });
});
