import { describe, expect, it, vi } from "vitest";
import { crawlPages, fetchPageWithRetries } from "./crawler";
import { RobotsChecker } from "./robots";

const baseConfig = {
  concurrency: 3,
  requestDelayMs: 0,
  timeoutMs: 1000,
  maxRetries: 2,
  userAgent: "test-agent",
};

function fetchReturning(status: number, body = "<html></html>"): typeof fetch {
  return (async () =>
    new Response(body, { status, headers: { "content-type": "text/html" } })) as typeof fetch;
}

describe("fetchPageWithRetries", () => {
  it("returns the page on a 200", async () => {
    const { html, meta } = await fetchPageWithRetries(
      "https://example.com/",
      baseConfig,
      fetchReturning(200, "<html>hi</html>")
    );
    expect(html).toBe("<html>hi</html>");
    expect(meta.status).toBe(200);
    expect(meta.error).toBeUndefined();
  });

  it("retries on 5xx and eventually succeeds", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      if (calls < 3) return new Response("", { status: 503 });
      return new Response("<html>ok</html>", { status: 200 });
    }) as typeof fetch;

    const { html, meta } = await fetchPageWithRetries(
      "https://example.com/",
      baseConfig,
      fetchImpl
    );
    expect(calls).toBe(3);
    expect(html).toBe("<html>ok</html>");
    expect(meta.status).toBe(200);
  });

  it("records an error after exhausting retries on network failure", async () => {
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const { html, meta } = await fetchPageWithRetries(
      "https://example.com/",
      { ...baseConfig, maxRetries: 1 },
      fetchImpl
    );
    expect(html).toBe("");
    expect(meta.status).toBeNull();
    expect(meta.error).toContain("network down");
  });
});

describe("crawlPages", () => {
  it("skips URLs disallowed by robots.txt", async () => {
    const robots = new RobotsChecker([{ prefix: "/admin", allow: false }]);
    const fetchImpl = vi.fn(fetchReturning(200));

    const pages = await crawlPages(
      ["https://example.com/admin/secret", "https://example.com/pricing"],
      robots,
      baseConfig,
      fetchImpl
    );

    expect(pages).toHaveLength(1);
    expect(pages[0].url).toBe("https://example.com/pricing");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fetches every allowed URL exactly once", async () => {
    const robots = new RobotsChecker([]);
    const urls = [
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
    ];
    const fetchImpl = vi.fn(fetchReturning(200));

    const pages = await crawlPages(urls, robots, baseConfig, fetchImpl);

    expect(pages.map((p) => p.url).sort()).toEqual(urls);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
