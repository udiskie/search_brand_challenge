import { describe, expect, it } from "vitest";
import { fetchSitemap } from "./sitemap";

function mockFetch(responses: Record<string, string>): typeof fetch {
  return (async (url: string | URL) => {
    const key = url.toString();
    const body = responses[key];
    if (body === undefined) {
      return new Response("not found", { status: 404 });
    }
    return new Response(body, { status: 200 });
  }) as typeof fetch;
}

describe("fetchSitemap", () => {
  it("parses a flat urlset", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset>
        <url><loc>https://example.com/</loc><priority>1.0</priority></url>
        <url><loc>https://example.com/pricing</loc><changefreq>weekly</changefreq></url>
      </urlset>`;
    const fetchImpl = mockFetch({ "https://example.com/sitemap.xml": xml });

    const entries = await fetchSitemap(
      "https://example.com/sitemap.xml",
      fetchImpl
    );

    expect(entries).toEqual([
      { loc: "https://example.com/", lastmod: undefined, changefreq: undefined, priority: 1 },
      { loc: "https://example.com/pricing", lastmod: undefined, changefreq: "weekly", priority: undefined },
    ]);
  });

  it("recursively expands a sitemap index", async () => {
    const index = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex>
        <sitemap><loc>https://example.com/sitemap-a.xml</loc></sitemap>
        <sitemap><loc>https://example.com/sitemap-b.xml</loc></sitemap>
      </sitemapindex>`;
    const a = `<urlset><url><loc>https://example.com/a</loc></url></urlset>`;
    const b = `<urlset><url><loc>https://example.com/b</loc></url></urlset>`;
    const fetchImpl = mockFetch({
      "https://example.com/sitemap.xml": index,
      "https://example.com/sitemap-a.xml": a,
      "https://example.com/sitemap-b.xml": b,
    });

    const entries = await fetchSitemap(
      "https://example.com/sitemap.xml",
      fetchImpl
    );

    expect(entries.map((e) => e.loc).sort()).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("returns an empty list when the sitemap 404s", async () => {
    const fetchImpl = mockFetch({});
    const entries = await fetchSitemap(
      "https://example.com/sitemap.xml",
      fetchImpl
    );
    expect(entries).toEqual([]);
  });
});
