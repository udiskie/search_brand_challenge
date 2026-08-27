import { describe, expect, it } from "vitest";
import { buildReport, renderReportMarkdown } from "./reportGenerator";
import type { GeoSignals, SitemapCoverage, StructuredSignals, Tagcloud } from "../scraper/types";
import type { AeoMetrics } from "./types";

const seoSignals: StructuredSignals[] = [
  {
    url: "https://example.com/",
    title: "Example",
    titleLength: 7,
    metaDescription: null,
    metaDescriptionLength: 0,
    headings: [],
    h1Count: 0,
    headingOrderIssues: ["missing h1"],
    schemaTypes: [],
    internalLinkCount: 2,
    externalLinkCount: 1,
    imagesTotal: 2,
    imagesMissingAlt: 1,
    wordCount: 100,
    topKeywordDensity: [],
  },
];

const sitemapCoverage: SitemapCoverage = {
  totalUrls: 2,
  fetchedUrls: 1,
  brokenUrls: ["https://example.com/broken"],
  skippedUrls: [],
};

const tagcloud: Tagcloud = {
  site: [{ term: "keyboard", score: 10, documentFrequency: 1 }],
  byPage: {},
};

const geoSignals: GeoSignals[] = [
  {
    url: "https://example.com/",
    entityClarity: { hasSelfContainedDefinition: false, definitionSnippet: null },
    factualDensity: { numberCount: 0, comparativeStatements: 0, promotionalAdjectiveCount: 5, score: 0.1 },
    eeat: { hasVisibleAuthor: false, hasPublishDate: false, hasUpdatedDate: false, outboundCitationCount: 0 },
    extractableStructure: { listCount: 0, tableCount: 0, definitionBlockCount: 0, score: 0 },
  },
];

const aeoMetrics: AeoMetrics = {
  totalRuns: 10,
  perBrand: [
    {
      brand: "Linear",
      shareOfVoice: 0.2,
      relativeShareOfVoice: 0.25,
      averagePosition: 2.5,
      firstMentionRate: 0.1,
      sentimentScore: -0.2,
      mentionCount: 2,
    },
    {
      brand: "Jira",
      shareOfVoice: 0.8,
      relativeShareOfVoice: 4,
      averagePosition: 1.2,
      firstMentionRate: 0.7,
      sentimentScore: 0.5,
      mentionCount: 8,
    },
  ],
  coOccurrence: [],
  byDimension: [],
};

describe("buildReport", () => {
  const report = buildReport({
    product: "linear",
    brand: "Linear",
    competitors: ["Jira"],
    seoSignals,
    sitemapCoverage,
    tagcloud,
    geoSignals,
    aeoMetrics,
    crossValidationGaps: [{ term: "cycles", siteScore: 5, mentionedByModel: false }],
  });

  it("scores SEO/GEO/AEO between 0 and 100 with a label", () => {
    for (const s of report.scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(["good", "needs_work", "critical"]).toContain(s.label);
    }
  });

  it("flags the missing h1 and missing meta description", () => {
    expect(
      report.priorities.some((p) => p.finding.includes("Missing H1"))
    ).toBe(true);
    expect(
      report.priorities.some((p) => p.finding.includes("Missing meta description"))
    ).toBe(true);
  });

  it("flags low factual density and missing E-E-A-T on the GEO side", () => {
    expect(report.priorities.some((p) => p.dimension === "geo" && p.finding.includes("factual density"))).toBe(
      true
    );
    expect(
      report.priorities.some((p) => p.dimension === "geo" && p.finding.includes("author or publish date"))
    ).toBe(true);
  });

  it("flags AEO share-of-voice below the competitor average and negative sentiment", () => {
    expect(
      report.priorities.some((p) => p.dimension === "aeo" && p.finding.includes("Share of Voice"))
    ).toBe(true);
    expect(
      report.priorities.some((p) => p.dimension === "aeo" && p.finding.includes("negative sentiment"))
    ).toBe(true);
  });

  it("surfaces the cross-validation gap", () => {
    expect(report.priorities.some((p) => p.finding.includes("cycles"))).toBe(true);
  });

  it("sorts priorities by impact (high first), then effort (low first)", () => {
    const impactRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < report.priorities.length; i++) {
      expect(impactRank[report.priorities[i - 1].impact]).toBeLessThanOrEqual(
        impactRank[report.priorities[i].impact]
      );
    }
  });

  it("renders markdown containing every top-level section", () => {
    const markdown = renderReportMarkdown(report);
    expect(markdown).toContain("# Brand Visibility Audit: Linear");
    expect(markdown).toContain("## Executive summary");
    expect(markdown).toContain("## SEO");
    expect(markdown).toContain("## GEO");
    expect(markdown).toContain("## AEO");
    expect(markdown).toContain("## Priority matrix");
  });
});
