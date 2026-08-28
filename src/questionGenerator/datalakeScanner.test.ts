import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractedDir, geoDir, writeJson } from "../scraper/datalake";
import { scanProductHooks } from "./datalakeScanner";

async function seed(product: string) {
  await writeJson(path.join(extractedDir(product), "structured_signals.json"), [
    {
      url: "https://example.com/",
      title: "Example",
      titleLength: 7,
      metaDescription: "Example is the fastest way to track engineering work.",
      metaDescriptionLength: 54,
      headings: [],
      h1Count: 1,
      headingOrderIssues: [],
      schemaTypes: [],
      internalLinkCount: 1,
      externalLinkCount: 0,
      imagesTotal: 0,
      imagesMissingAlt: 0,
      wordCount: 100,
      topKeywordDensity: [],
    },
    {
      url: "https://example.com/short",
      title: "Short",
      titleLength: 5,
      metaDescription: "Too short",
      metaDescriptionLength: 9,
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
      url: "https://example.com/",
      entityClarity: {
        hasSelfContainedDefinition: true,
        definitionSnippet: "Example is a keyboard-first issue tracker for engineering teams.",
      },
      factualDensity: { numberCount: 0, comparativeStatements: 0, promotionalAdjectiveCount: 0, score: 0.5 },
      eeat: { hasVisibleAuthor: false, hasPublishDate: false, hasUpdatedDate: false, outboundCitationCount: 0 },
      extractableStructure: { listCount: 0, tableCount: 0, definitionBlockCount: 0, score: 0 },
    },
  ]);

  await writeJson(path.join(extractedDir(product), "tagcloud.json"), {
    site: [
      { term: "cycles", score: 10, documentFrequency: 3 },
      { term: "example", score: 8, documentFrequency: 5 },
      { term: "onceoff", score: 6, documentFrequency: 1 }, // below df threshold
      { term: "abc", score: 4, documentFrequency: 3 }, // below length threshold
      { term: "contextreply", score: 20, documentFrequency: 4 }, // known scrape artifact
    ],
    byPage: {},
  });

  await writeJson(path.join(extractedDir(product), "phrase_cloud.json"), [
    {
      term: "cycles",
      occurrences: [{ url: "https://example.com/", snippet: "Plan work in cycles." }],
    },
  ]);
}

describe("scanProductHooks", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(path.join(tmpdir(), "question-gen-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws a clear error when scraper output is missing", async () => {
    await expect(scanProductHooks("missing-product")).rejects.toThrow(/Missing scraper output/);
  });

  it("includes a long-enough meta description but not a too-short one", async () => {
    await seed("example");
    const hooks = await scanProductHooks("example");
    expect(hooks.some((h) => h.hook.includes("fastest way to track"))).toBe(true);
    expect(hooks.some((h) => h.hook === "Too short")).toBe(false);
  });

  it("includes the GEO self-contained definition", async () => {
    await seed("example");
    const hooks = await scanProductHooks("example");
    expect(hooks.some((h) => h.source === "geo_definition" && h.hook.includes("keyboard-first"))).toBe(
      true
    );
  });

  it("includes a recurring tagcloud term with its phrase-cloud evidence", async () => {
    await seed("example");
    const hooks = await scanProductHooks("example");
    const cycles = hooks.find((h) => h.hook === "cycles");
    expect(cycles).toBeDefined();
    expect(cycles?.evidence[0].snippet).toContain("Plan work in cycles");
  });

  it("filters out low-document-frequency terms, short terms, and known scrape artifacts", async () => {
    await seed("example");
    const hooks = await scanProductHooks("example");
    expect(hooks.some((h) => h.hook === "onceoff")).toBe(false);
    expect(hooks.some((h) => h.hook === "abc")).toBe(false);
    expect(hooks.some((h) => h.hook === "contextreply")).toBe(false);
  });

  it("excludes terms passed via excludeTerms (e.g. the brand's own name)", async () => {
    await seed("example");
    const hooks = await scanProductHooks("example", { excludeTerms: ["example"] });
    expect(hooks.some((h) => h.hook === "example")).toBe(false);
  });

  it("dedupes an identical hook phrase repeated across pages/sources", async () => {
    // A site-wide default meta description reused on multiple pages (or
    // the same sentence caught as both a meta description and a GEO
    // definition) must collapse to one hook -- `hook` text is used as a
    // React key downstream (questions/page.tsx), so a duplicate here is a
    // real "two children with the same key" bug, not just noise.
    const product = "dup-hooks";
    const sharedText = "The AI workspace where teams get more done, faster.";
    await writeJson(path.join(extractedDir(product), "structured_signals.json"), [
      {
        url: "https://example.com/",
        title: "Home",
        titleLength: 4,
        metaDescription: sharedText,
        metaDescriptionLength: sharedText.length,
        headings: [],
        h1Count: 1,
        headingOrderIssues: [],
        schemaTypes: [],
        internalLinkCount: 1,
        externalLinkCount: 0,
        imagesTotal: 0,
        imagesMissingAlt: 0,
        wordCount: 100,
        topKeywordDensity: [],
      },
      {
        url: "https://example.com/pricing",
        title: "Pricing",
        titleLength: 7,
        metaDescription: sharedText,
        metaDescriptionLength: sharedText.length,
        headings: [],
        h1Count: 1,
        headingOrderIssues: [],
        schemaTypes: [],
        internalLinkCount: 1,
        externalLinkCount: 0,
        imagesTotal: 0,
        imagesMissingAlt: 0,
        wordCount: 80,
        topKeywordDensity: [],
      },
    ]);
    await writeJson(path.join(geoDir(product), "geo_signals.json"), []);
    await writeJson(path.join(extractedDir(product), "tagcloud.json"), { site: [], byPage: {} });
    await writeJson(path.join(extractedDir(product), "phrase_cloud.json"), []);

    const hooks = await scanProductHooks(product);
    expect(hooks.filter((h) => h.hook === sharedText)).toHaveLength(1);
  });

  it("excludes a meta description/definition that merely mentions the brand inline", async () => {
    // The meta description "Example is the fastest way to..." and the GEO
    // definition "Example is a keyboard-first..." both contain "example"
    // without being equal to it -- a naive exact-match exclude would let
    // both through, defeating the point of testing for an *organic*
    // mention.
    await seed("example");
    const hooks = await scanProductHooks("example", { excludeTerms: ["example"] });
    expect(hooks.some((h) => h.source === "meta_description")).toBe(false);
    expect(hooks.some((h) => h.source === "geo_definition")).toBe(false);
  });
});
