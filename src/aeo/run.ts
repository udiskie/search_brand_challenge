import path from "node:path";
import {
  aeoDir,
  extractedDir,
  geoDir,
  productDir,
  readJson,
  reportDir,
  writeJson,
  writeText,
} from "../scraper/datalake";
import { runScrape } from "../scraper/run";
import type {
  CrawlMode,
  GeoSignals,
  SitemapCoverage,
  StructuredSignals,
  Tagcloud,
} from "../scraper/types";
import type { CandidateQuestion, InferentialQuestion } from "../questionGenerator/types";
import { computeAeoMetrics } from "./aeoMetrics";
import { hookQuestionsToPrompts, inferentialQuestionsToPrompts } from "./brandGroundedAdapter";
import { computeBrandGroundedMetrics } from "./brandGroundedMetrics";
import { parseBrandGroundedRun, runGeminiForBrandGroundedPrompts } from "./brandGroundedRunner";
import { findGeoAeoGaps } from "./crossValidate";
import { runGeminiForPrompts, type GeminiClientConfig } from "./geminiClient";
import { parseRun } from "./mentionExtractor";
import { generatePrompts } from "./promptGenerator";
import { buildReport, renderReportMarkdown } from "./reportGenerator";
import type { AeoAuditConfig, BrandGroundedMetrics, BrandGroundedPrompt, DimensionScore } from "./types";

export type BrandGroundedQuestionSource = "hooks" | "inferential" | "both";

export interface IncludeBrandGroundedQuestionsOptions {
  source: BrandGroundedQuestionSource;
  /** Defaults to 2 -- kept modest since there can be 100+ candidate questions. */
  runsPerPrompt?: number;
  /** Caps how many candidate questions are actually sent to Gemini. */
  limit?: number;
}

export interface AeoRunOptions {
  product: string;
  auditConfig: AeoAuditConfig;
  geminiConfig: GeminiClientConfig;
  /** If scraper output is missing for `product`, scrape this URL first. */
  siteUrl?: string;
  scrapeMode?: CrawlMode;
  /**
   * Also run reviewed Part 1/Part 2 candidate questions (from
   * user-question-generator) through Gemini as a third, explicitly
   * brand-grounded prompt source -- see WORK_PLAN.md's "wire Part 1 and
   * Part 2 questions into the AEO pipeline" future-work entry. Requires
   * `npm run questions` to have been run for this product first.
   */
  includeBrandGroundedQuestions?: IncludeBrandGroundedQuestionsOptions;
}

export interface AeoRunSummary {
  product: string;
  totalPrompts: number;
  totalRuns: number;
  reportScores: DimensionScore[];
  brandGroundedRunCount?: number;
}

interface CandidateQuestionsFile {
  hookQuestions: CandidateQuestion[];
  inferentialQuestions: InferentialQuestion[];
}

async function loadCandidateQuestions(product: string): Promise<CandidateQuestionsFile | undefined> {
  return readJson<CandidateQuestionsFile>(
    path.join(productDir(product), "questions", "candidate_user_questions.json")
  );
}

interface ScraperOutput {
  seoSignals: StructuredSignals[];
  sitemapCoverage: SitemapCoverage;
  tagcloud: Tagcloud;
  geoSignals: GeoSignals[];
}

async function loadScraperOutput(product: string): Promise<Partial<ScraperOutput>> {
  const [seoSignals, sitemapCoverage, tagcloud, geoSignals] = await Promise.all([
    readJson<StructuredSignals[]>(path.join(extractedDir(product), "structured_signals.json")),
    readJson<SitemapCoverage>(path.join(extractedDir(product), "sitemap_coverage.json")),
    readJson<Tagcloud>(path.join(extractedDir(product), "tagcloud.json")),
    readJson<GeoSignals[]>(path.join(geoDir(product), "geo_signals.json")),
  ]);
  return { seoSignals, sitemapCoverage, tagcloud, geoSignals };
}

function isComplete(output: Partial<ScraperOutput>): output is ScraperOutput {
  return !!(output.seoSignals && output.sitemapCoverage && output.tagcloud && output.geoSignals);
}

/**
 * Runs the AEO probe (prompt generation + repeated Gemini calls + metrics
 * + cross-validation) and produces the consolidated SEO/GEO/AEO report.
 * Reuses the scraper's data lake output for `product` if present;
 * otherwise scrapes `siteUrl` first (per WORK_PLAN.md's stated skill
 * behavior) rather than failing outright.
 */
export async function runAeoAudit(
  options: AeoRunOptions,
  fetchImpl: typeof fetch = fetch
): Promise<AeoRunSummary> {
  const { product, auditConfig, geminiConfig } = options;

  let scraperOutput = await loadScraperOutput(product);

  if (!isComplete(scraperOutput) && options.siteUrl) {
    await runScrape(
      {
        product,
        siteUrl: options.siteUrl,
        mode: options.scrapeMode ?? "quick",
        quickPageCap: 15,
        concurrency: 3,
        requestDelayMs: 300,
        timeoutMs: 10_000,
        maxRetries: 2,
        userAgent: "search-brand-datalake-scraper/0.1 (brand visibility audit scraper)",
      },
      fetchImpl
    );
    scraperOutput = await loadScraperOutput(product);
  }

  if (!isComplete(scraperOutput)) {
    throw new Error(
      `Missing scraper output for product "${product}" in datalake/${product}/. ` +
        `Pass --url to scrape it first, or run "npm run scrape -- --product ${product} --url <site>".`
    );
  }

  const prompts = generatePrompts(auditConfig);
  await writeJson(path.join(aeoDir(product), "prompts_config.json"), {
    config: auditConfig,
    prompts,
  });

  const runs = await runGeminiForPrompts(
    product,
    prompts,
    auditConfig.runsPerPrompt,
    geminiConfig,
    fetchImpl
  );

  const allBrands = [auditConfig.brand, ...auditConfig.competitors];
  // A failed call (timeout, network error, safety block -- rawText null)
  // is a data-collection gap, not a "the model didn't mention the brand"
  // signal. Every raw run is still persisted above for the audit trail,
  // but only successful ones count toward the metrics denominator --
  // otherwise a spike in failures would silently deflate every brand's
  // Share of Voice.
  const parsedRuns = runs
    .filter((run) => run.rawText !== null)
    .map((run) => parseRun(run, allBrands));

  const aeoMetrics = computeAeoMetrics(parsedRuns, auditConfig.brand, auditConfig.competitors);
  await writeJson(path.join(aeoDir(product), "aggregated_metrics.json"), aeoMetrics);

  const crossValidationGaps = findGeoAeoGaps(
    scraperOutput.tagcloud.site,
    parsedRuns,
    auditConfig.brand
  );

  let brandGroundedMetrics: BrandGroundedMetrics | undefined;
  let brandGroundedRunCount: number | undefined;

  if (options.includeBrandGroundedQuestions) {
    const { source, runsPerPrompt = 2, limit } = options.includeBrandGroundedQuestions;
    const candidateQuestions = await loadCandidateQuestions(product);
    if (!candidateQuestions) {
      throw new Error(
        `Missing candidate questions for product "${product}" in datalake/${product}/questions/. ` +
          `Run "npm run questions -- --product ${product} --brand ${auditConfig.brand}" first.`
      );
    }

    let brandGroundedPrompts: BrandGroundedPrompt[] = [];
    if (source === "hooks" || source === "both") {
      brandGroundedPrompts.push(...hookQuestionsToPrompts(candidateQuestions.hookQuestions));
    }
    if (source === "inferential" || source === "both") {
      brandGroundedPrompts.push(
        ...inferentialQuestionsToPrompts(candidateQuestions.inferentialQuestions)
      );
    }
    if (limit !== undefined) {
      brandGroundedPrompts = brandGroundedPrompts.slice(0, limit);
    }

    const brandGroundedRuns = await runGeminiForBrandGroundedPrompts(
      product,
      brandGroundedPrompts,
      runsPerPrompt,
      geminiConfig,
      fetchImpl
    );
    brandGroundedRunCount = brandGroundedRuns.length;

    const parsedBrandGroundedRuns = brandGroundedRuns
      .filter((run) => run.rawText !== null)
      .map((run) => parseBrandGroundedRun(run, allBrands));

    brandGroundedMetrics = computeBrandGroundedMetrics(
      parsedBrandGroundedRuns,
      auditConfig.brand,
      auditConfig.competitors
    );
    await writeJson(path.join(aeoDir(product), "brand_grounded_metrics.json"), brandGroundedMetrics);
  }

  const report = buildReport({
    product,
    brand: auditConfig.brand,
    competitors: auditConfig.competitors,
    seoSignals: scraperOutput.seoSignals,
    sitemapCoverage: scraperOutput.sitemapCoverage,
    tagcloud: scraperOutput.tagcloud,
    geoSignals: scraperOutput.geoSignals,
    aeoMetrics,
    crossValidationGaps,
    brandGrounded: brandGroundedMetrics,
  });

  await writeJson(path.join(reportDir(product), "report.json"), report);
  await writeJson(path.join(reportDir(product), "priorities.json"), report.priorities);
  await writeText(path.join(reportDir(product), "report.md"), renderReportMarkdown(report));

  return {
    product,
    totalPrompts: prompts.length,
    totalRuns: runs.length,
    reportScores: report.scores,
    brandGroundedRunCount,
  };
}
