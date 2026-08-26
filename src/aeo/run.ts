import path from "node:path";
import {
  aeoDir,
  extractedDir,
  geoDir,
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
import { computeAeoMetrics } from "./aeoMetrics";
import { findGeoAeoGaps } from "./crossValidate";
import { runGeminiForPrompts, type GeminiClientConfig } from "./geminiClient";
import { parseRun } from "./mentionExtractor";
import { generatePrompts } from "./promptGenerator";
import { buildReport, renderReportMarkdown } from "./reportGenerator";
import type { AeoAuditConfig, DimensionScore } from "./types";

export interface AeoRunOptions {
  product: string;
  auditConfig: AeoAuditConfig;
  geminiConfig: GeminiClientConfig;
  /** If scraper output is missing for `product`, scrape this URL first. */
  siteUrl?: string;
  scrapeMode?: CrawlMode;
}

export interface AeoRunSummary {
  product: string;
  totalPrompts: number;
  totalRuns: number;
  reportScores: DimensionScore[];
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
  const parsedRuns = runs.map((run) => parseRun(run, allBrands));

  const aeoMetrics = computeAeoMetrics(parsedRuns, auditConfig.brand, auditConfig.competitors);
  await writeJson(path.join(aeoDir(product), "aggregated_metrics.json"), aeoMetrics);

  const crossValidationGaps = findGeoAeoGaps(
    scraperOutput.tagcloud.site,
    parsedRuns,
    auditConfig.brand
  );

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
  });

  await writeJson(path.join(reportDir(product), "report.json"), report);
  await writeJson(path.join(reportDir(product), "priorities.json"), report.priorities);
  await writeText(path.join(reportDir(product), "report.md"), renderReportMarkdown(report));

  return {
    product,
    totalPrompts: prompts.length,
    totalRuns: runs.length,
    reportScores: report.scores,
  };
}
