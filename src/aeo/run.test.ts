import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractedDir, geoDir, writeJson } from "../scraper/datalake";
import { runAeoAudit } from "./run";
import type { AeoAuditConfig } from "./types";

const baseAuditConfig: AeoAuditConfig = {
  brand: "Linear",
  competitors: ["Jira"],
  category: "project management",
  promptCount: 4,
  runsPerPrompt: 2,
  temperature: 0.9,
  model: "gemini-2.0-flash",
};

const baseGeminiConfig = {
  apiKey: "test-key",
  model: "gemini-2.0-flash",
  temperature: 0.9,
  timeoutMs: 1000,
  maxRetries: 1,
  concurrency: 2,
  requestDelayMs: 0,
};

function geminiFetch(text: string): typeof fetch {
  return (async (url: string | URL) => {
    if (url.toString().includes("generativelanguage.googleapis.com")) {
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] }),
        { status: 200 }
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

async function seedScraperOutput(product: string) {
  await writeJson(path.join(extractedDir(product), "structured_signals.json"), [
    {
      url: "https://example.com/",
      title: "Example",
      titleLength: 7,
      metaDescription: "Example is a tool.",
      metaDescriptionLength: 18,
      headings: [],
      h1Count: 1,
      headingOrderIssues: [],
      schemaTypes: [],
      internalLinkCount: 1,
      externalLinkCount: 0,
      imagesTotal: 0,
      imagesMissingAlt: 0,
      wordCount: 50,
      topKeywordDensity: [],
    },
  ]);
  await writeJson(path.join(extractedDir(product), "sitemap_coverage.json"), {
    totalUrls: 1,
    fetchedUrls: 1,
    brokenUrls: [],
    skippedUrls: [],
  });
  await writeJson(path.join(extractedDir(product), "tagcloud.json"), {
    site: [{ term: "keyboard", score: 5, documentFrequency: 1 }],
    byPage: {},
  });
  await writeJson(path.join(geoDir(product), "geo_signals.json"), [
    {
      url: "https://example.com/",
      entityClarity: { hasSelfContainedDefinition: true, definitionSnippet: "Example is a tool." },
      factualDensity: { numberCount: 1, comparativeStatements: 0, promotionalAdjectiveCount: 0, score: 0.8 },
      eeat: { hasVisibleAuthor: true, hasPublishDate: true, hasUpdatedDate: false, outboundCitationCount: 0 },
      extractableStructure: { listCount: 1, tableCount: 0, definitionBlockCount: 0, score: 0.5 },
    },
  ]);
}

describe("runAeoAudit", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(path.join(tmpdir(), "aeo-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws a clear error when scraper output is missing and no siteUrl is given", async () => {
    await expect(
      runAeoAudit({
        product: "linear",
        auditConfig: baseAuditConfig,
        geminiConfig: baseGeminiConfig,
      })
    ).rejects.toThrow(/Missing scraper output/);
  });

  it("reuses existing scraper output and writes aeo + report artifacts", async () => {
    await seedScraperOutput("linear");

    const summary = await runAeoAudit(
      {
        product: "linear",
        auditConfig: baseAuditConfig,
        geminiConfig: baseGeminiConfig,
      },
      geminiFetch("Linear and Jira are both solid, keyboard-first options.")
    );

    expect(summary.totalPrompts).toBe(4);
    expect(summary.totalRuns).toBe(8); // 4 prompts x 2 runs
    expect(summary.reportScores).toHaveLength(3);

    const readJson = (...parts: string[]) =>
      JSON.parse(readFileSync(path.join(tmpDir, "datalake", ...parts), "utf-8"));

    const promptsConfig = readJson("linear", "aeo", "prompts_config.json");
    expect(promptsConfig.prompts).toHaveLength(4);

    const aggregated = readJson("linear", "aeo", "aggregated_metrics.json");
    expect(aggregated.totalRuns).toBe(8);

    const report = readJson("linear", "report", "report.json");
    expect(report.brand).toBe("Linear");

    const reportMd = readFileSync(
      path.join(tmpDir, "datalake", "linear", "report", "report.md"),
      "utf-8"
    );
    expect(reportMd).toContain("# Brand Visibility Audit: Linear");
  });
});
