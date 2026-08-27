import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractedDir, geoDir, writeJson } from "../scraper/datalake";
import { scanProblemAudienceClaims } from "./problemAudienceScanner";

async function seed(product: string) {
  await writeJson(path.join(extractedDir(product), "structured_signals.json"), [
    {
      url: "https://example.com/start-guide",
      title: "Start Guide",
      titleLength: 11,
      metaDescription:
        "Example helps engineering teams plan, track, and deliver work without a lot of overhead.",
      metaDescriptionLength: 89,
      headings: [],
      h1Count: 1,
      headingOrderIssues: [],
      schemaTypes: [],
      internalLinkCount: 0,
      externalLinkCount: 0,
      imagesTotal: 0,
      imagesMissingAlt: 0,
      wordCount: 20,
      topKeywordDensity: [],
    },
    {
      url: "https://example.com/leaky",
      title: "Leaky",
      titleLength: 5,
      metaDescription: "Use Example to reduce noise and focus on what matters for your startup.",
      metaDescriptionLength: 73,
      headings: [],
      h1Count: 1,
      headingOrderIssues: [],
      schemaTypes: [],
      internalLinkCount: 0,
      externalLinkCount: 0,
      imagesTotal: 0,
      imagesMissingAlt: 0,
      wordCount: 10,
      topKeywordDensity: [],
    },
    {
      url: "https://example.com/pricing",
      title: "Pricing",
      titleLength: 7,
      metaDescription:
        "Upgrade to enable unlimited issues, enhanced security controls, and additional features.",
      metaDescriptionLength: 89,
      headings: [],
      h1Count: 1,
      headingOrderIssues: [],
      schemaTypes: [],
      internalLinkCount: 0,
      externalLinkCount: 0,
      imagesTotal: 0,
      imagesMissingAlt: 0,
      wordCount: 10,
      topKeywordDensity: [],
    },
    {
      url: "https://example.com/",
      title: "Home",
      titleLength: 4,
      metaDescription: "Example helps product teams ship with high velocity.",
      metaDescriptionLength: 54,
      headings: [],
      h1Count: 1,
      headingOrderIssues: [],
      schemaTypes: [],
      internalLinkCount: 0,
      externalLinkCount: 0,
      imagesTotal: 0,
      imagesMissingAlt: 0,
      wordCount: 10,
      topKeywordDensity: [],
    },
  ]);

  await writeJson(path.join(geoDir(product), "geo_signals.json"), [
    {
      url: "https://example.com/start-guide",
      // Duplicates the page's own meta description verbatim, as
      // extractGeoSignals's definition-snippet fallback often does --
      // exercises the evidence-dedup path.
      entityClarity: {
        hasSelfContainedDefinition: true,
        definitionSnippet:
          "Example helps engineering teams plan, track, and deliver work without a lot of overhead.",
      },
      factualDensity: { numberCount: 0, comparativeStatements: 0, promotionalAdjectiveCount: 0, score: 0.5 },
      eeat: { hasVisibleAuthor: false, hasPublishDate: false, hasUpdatedDate: false, outboundCitationCount: 0 },
      extractableStructure: { listCount: 0, tableCount: 0, definitionBlockCount: 0, score: 0 },
    },
    {
      url: "https://example.com/leaky",
      entityClarity: { hasSelfContainedDefinition: false, definitionSnippet: null },
      factualDensity: { numberCount: 0, comparativeStatements: 0, promotionalAdjectiveCount: 0, score: 0.5 },
      eeat: { hasVisibleAuthor: false, hasPublishDate: false, hasUpdatedDate: false, outboundCitationCount: 0 },
      extractableStructure: { listCount: 0, tableCount: 0, definitionBlockCount: 0, score: 0 },
    },
    {
      url: "https://example.com/pricing",
      entityClarity: { hasSelfContainedDefinition: false, definitionSnippet: null },
      factualDensity: { numberCount: 0, comparativeStatements: 0, promotionalAdjectiveCount: 0, score: 0.5 },
      eeat: { hasVisibleAuthor: false, hasPublishDate: false, hasUpdatedDate: false, outboundCitationCount: 0 },
      extractableStructure: { listCount: 0, tableCount: 0, definitionBlockCount: 0, score: 0 },
    },
    {
      url: "https://example.com/",
      entityClarity: { hasSelfContainedDefinition: false, definitionSnippet: null },
      factualDensity: { numberCount: 0, comparativeStatements: 0, promotionalAdjectiveCount: 0, score: 0.5 },
      eeat: { hasVisibleAuthor: false, hasPublishDate: false, hasUpdatedDate: false, outboundCitationCount: 0 },
      extractableStructure: { listCount: 0, tableCount: 0, definitionBlockCount: 0, score: 0 },
    },
  ]);

  await writeJson(path.join(extractedDir(product), "phrase_cloud.json"), []);
}

describe("scanProblemAudienceClaims", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(path.join(tmpdir(), "problem-scan-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws a clear error when scraper output is missing", async () => {
    await expect(scanProblemAudienceClaims("missing-product")).rejects.toThrow(
      /Missing scraper output/
    );
  });

  it("extracts a 'helps X do Y' problem clause without the verb/filler", async () => {
    await seed("example");
    const claims = await scanProblemAudienceClaims("example", { excludeTerms: ["example"] });
    const claim = claims.find((c) => c.problem.startsWith("plan, track"));
    expect(claim).toBeDefined();
    expect(claim?.problem).not.toContain("helps");
    expect(claim?.problem).not.toMatch(/\bexample\b/i);
  });

  it("detects an audience signal co-occurring in the same source text", async () => {
    await seed("example");
    const claims = await scanProblemAudienceClaims("example", { excludeTerms: ["example"] });
    const claim = claims.find((c) => c.problem.startsWith("plan, track"));
    expect(claim?.audience.userTypes).toContain("engineering teams");
  });

  it("normalizes a direct-verb claim to base form and excludes fragments naming the brand", async () => {
    await seed("example");
    const claims = await scanProblemAudienceClaims("example", { excludeTerms: ["example"] });
    // "Use Example to reduce noise..." -- the captured fragment starts at
    // "reduce", after the brand mention, so it should survive filtering.
    const claim = claims.find((c) => c.problem.startsWith("reduce noise"));
    expect(claim).toBeDefined();
    expect(claim?.audience.orgTypes).toContain("startup");
  });

  it("deduplicates identical problem claims across sources, merging evidence", async () => {
    await seed("example");
    const claims = await scanProblemAudienceClaims("example", { excludeTerms: ["example"] });
    const problems = claims.map((c) => c.problem.toLowerCase());
    expect(new Set(problems).size).toBe(problems.length);
  });

  it("deduplicates identical evidence entries (meta description duplicated as a GEO definition)", async () => {
    await seed("example");
    const claims = await scanProblemAudienceClaims("example", { excludeTerms: ["example"] });
    const claim = claims.find((c) => c.problem.startsWith("plan, track"))!;
    const snippets = claim.evidence.map((e) => `${e.url}|${e.snippet}`);
    expect(new Set(snippets).size).toBe(snippets.length);
  });

  it("keeps the (normalized) verb for an 'enables X noun-phrase' claim instead of stripping it", async () => {
    await seed("example");
    const claims = await scanProblemAudienceClaims("example", { excludeTerms: ["example"] });
    const claim = claims.find((c) => c.problem.startsWith("enable unlimited issues"));
    expect(claim).toBeDefined();
  });

  it("prefers the plural audience match over a singular substring match", async () => {
    await seed("example");
    const claims = await scanProblemAudienceClaims("example", { excludeTerms: ["example"] });
    const claim = claims.find((c) => c.problem.includes("ship with high velocity"))!;
    expect(claim.audience.userTypes[0]).toBe("product teams");
  });

  it("drops trivially short fragments", async () => {
    await writeJson(path.join(extractedDir("tiny"), "structured_signals.json"), [
      {
        url: "https://example.com/",
        title: "t",
        titleLength: 1,
        metaDescription: "This helps us go.",
        metaDescriptionLength: 18,
        headings: [],
        h1Count: 1,
        headingOrderIssues: [],
        schemaTypes: [],
        internalLinkCount: 0,
        externalLinkCount: 0,
        imagesTotal: 0,
        imagesMissingAlt: 0,
        wordCount: 4,
        topKeywordDensity: [],
      },
    ]);
    await writeJson(path.join(geoDir("tiny"), "geo_signals.json"), []);
    await writeJson(path.join(extractedDir("tiny"), "phrase_cloud.json"), []);

    const claims = await scanProblemAudienceClaims("tiny");
    expect(claims).toEqual([]);
  });
});
