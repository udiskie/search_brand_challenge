import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractSeoSignals } from "./seoSignals";

const fixtureHtml = readFileSync(
  path.join(__dirname, "..", "__tests__", "fixtures", "sample-page.html"),
  "utf-8"
);

describe("extractSeoSignals", () => {
  const signals = extractSeoSignals("https://linear.app/", fixtureHtml);

  it("extracts title and meta description", () => {
    expect(signals.title).toBe("Linear – Project management for engineering teams");
    expect(signals.metaDescription).toContain("fastest way to plan");
  });

  it("builds the heading hierarchy without flagging issues", () => {
    expect(signals.h1Count).toBe(1);
    expect(signals.headings.map((h) => h.tag)).toEqual(["h1", "h2", "h3"]);
    expect(signals.headingOrderIssues).toEqual([]);
  });

  it("extracts JSON-LD schema types", () => {
    expect(signals.schemaTypes).toContain("SoftwareApplication");
  });

  it("classifies internal vs external links", () => {
    expect(signals.internalLinkCount).toBe(2);
    expect(signals.externalLinkCount).toBe(1);
  });

  it("counts images missing alt text", () => {
    expect(signals.imagesTotal).toBe(2);
    expect(signals.imagesMissingAlt).toBe(1);
  });

  it("computes word count and top keyword density from visible text only", () => {
    expect(signals.wordCount).toBeGreaterThan(0);
    expect(signals.topKeywordDensity.length).toBeGreaterThan(0);
    // "Pricing" (nav) and "Terms" (footer) should not dominate -- they were stripped.
    const terms = signals.topKeywordDensity.map((t) => t.term);
    expect(terms).toContain("linear");
  });

  it("flags a missing h1 on a page without one", () => {
    const html = "<html><head><title>No heading</title></head><body><h2>Sub only</h2></body></html>";
    const result = extractSeoSignals("https://example.com/", html);
    expect(result.h1Count).toBe(0);
    expect(result.headingOrderIssues).toContain("missing h1");
  });
});
