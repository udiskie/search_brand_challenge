import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractedDir, geoDir, productDir, writeJson } from "../scraper/datalake";
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

  it("excludes failed Gemini calls from the metrics denominator, not just SoV numerator", async () => {
    await seedScraperOutput("linear");

    let callCount = 0;
    const flakyFetch = (async (url: string | URL) => {
      if (!url.toString().includes("generativelanguage.googleapis.com")) {
        return new Response("not found", { status: 404 });
      }
      callCount++;
      // Every other call "times out" (simulated as a 500 after retries).
      if (callCount % 2 === 0) return new Response("", { status: 500 });
      return new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: "Linear is great." }] }, finishReason: "STOP" },
          ],
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    await runAeoAudit(
      {
        product: "linear",
        auditConfig: { ...baseAuditConfig, promptCount: 2, runsPerPrompt: 2 },
        geminiConfig: { ...baseGeminiConfig, maxRetries: 0 },
      },
      flakyFetch
    );

    const readJson = (...parts: string[]) =>
      JSON.parse(readFileSync(path.join(tmpDir, "datalake", ...parts), "utf-8"));

    // 4 calls attempted (2 prompts x 2 runs), 2 succeed -> denominator is 2, not 4.
    const aggregated = readJson("linear", "aeo", "aggregated_metrics.json");
    expect(aggregated.totalRuns).toBe(2);

    const runFiles = readJson("linear", "aeo", "prompts_config.json");
    expect(runFiles.prompts).toHaveLength(2);
  });

  it("throws a clear error when brand-grounded questions are requested but none were generated", async () => {
    await seedScraperOutput("linear");

    await expect(
      runAeoAudit(
        {
          product: "linear",
          auditConfig: baseAuditConfig,
          geminiConfig: baseGeminiConfig,
          includeBrandGroundedQuestions: { source: "both" },
        },
        geminiFetch("Linear is great.")
      )
    ).rejects.toThrow(/Missing candidate questions/);
  });

  it("runs brand-grounded questions through Gemini and reports them separately", async () => {
    await seedScraperOutput("linear");
    await writeJson(
      path.join(productDir("linear"), "questions", "candidate_user_questions.json"),
      {
        hookQuestions: [
          {
            id: "direct-differentiator-0",
            text: 'What tool matches "keyboard-first workflow"?',
            templateId: "direct-differentiator",
            hook: "keyboard-first workflow",
            hookSource: "tagcloud",
            evidenceUrls: ["https://example.com/"],
          },
        ],
        inferentialQuestions: [
          {
            id: "pain-vent-0",
            text: "As an engineering lead, my team keeps struggling to ship fast.",
            templateId: "pain-vent",
            stage: "pain_only",
            problem: "ship fast",
            audience: [],
            evidenceUrls: ["https://example.com/"],
          },
        ],
      }
    );

    const summary = await runAeoAudit(
      {
        product: "linear",
        auditConfig: baseAuditConfig,
        geminiConfig: baseGeminiConfig,
        includeBrandGroundedQuestions: { source: "both", runsPerPrompt: 1 },
      },
      geminiFetch("Linear and Jira are both solid, keyboard-first options.")
    );

    expect(summary.brandGroundedRunCount).toBe(2); // 1 hook + 1 inferential, 1 run each

    const readJson = (...parts: string[]) =>
      JSON.parse(readFileSync(path.join(tmpDir, "datalake", ...parts), "utf-8"));

    const brandGroundedMetrics = readJson("linear", "aeo", "brand_grounded_metrics.json");
    expect(brandGroundedMetrics.totalRuns).toBe(2);

    const report = readJson("linear", "report", "report.json");
    expect(report.brandGrounded.totalRuns).toBe(2);
    // Never touches the neutral scores/priorities.
    expect(report.scores).toHaveLength(3);

    const reportMd = readFileSync(
      path.join(tmpDir, "datalake", "linear", "report", "report.md"),
      "utf-8"
    );
    expect(reportMd).toContain("Brand-grounded question performance");
  });

  it("respects the source filter (hooks only) and the limit", async () => {
    await seedScraperOutput("linear");
    await writeJson(
      path.join(productDir("linear"), "questions", "candidate_user_questions.json"),
      {
        hookQuestions: [
          {
            id: "h0",
            text: "Hook question 0",
            templateId: "direct-differentiator",
            hook: "a",
            hookSource: "tagcloud",
            evidenceUrls: [],
          },
          {
            id: "h1",
            text: "Hook question 1",
            templateId: "direct-differentiator",
            hook: "b",
            hookSource: "tagcloud",
            evidenceUrls: [],
          },
        ],
        inferentialQuestions: [
          {
            id: "i0",
            text: "Inferential question 0",
            templateId: "pain-vent",
            stage: "pain_only",
            problem: "x",
            audience: [],
            evidenceUrls: [],
          },
        ],
      }
    );

    const summary = await runAeoAudit(
      {
        product: "linear",
        auditConfig: baseAuditConfig,
        geminiConfig: baseGeminiConfig,
        includeBrandGroundedQuestions: { source: "hooks", runsPerPrompt: 1, limit: 1 },
      },
      geminiFetch("Linear is great.")
    );

    // 2 hook questions available, limit=1 -> only 1 prompt x 1 run.
    expect(summary.brandGroundedRunCount).toBe(1);
  });
});
