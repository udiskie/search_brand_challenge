import type { GeoSignals, SitemapCoverage, StructuredSignals, Tagcloud } from "../scraper/types";
import type {
  AeoMetrics,
  BrandGroundedMetrics,
  CrossValidationGap,
  DimensionScore,
  EffortLevel,
  ImpactLevel,
  PriorityItem,
  Report,
  ScoreLabel,
} from "./types";

export interface ReportInput {
  product: string;
  brand: string;
  competitors: string[];
  seoSignals: StructuredSignals[];
  sitemapCoverage: SitemapCoverage;
  tagcloud: Tagcloud;
  geoSignals: GeoSignals[];
  aeoMetrics: AeoMetrics;
  crossValidationGaps: CrossValidationGap[];
  /** Optional: results from running Part 1/Part 2 questions through Gemini. Never affects scores/priorities -- see Report.brandGrounded's doc comment. */
  brandGrounded?: BrandGroundedMetrics;
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function scoreLabel(score: number): ScoreLabel {
  if (score >= 70) return "good";
  if (score >= 40) return "needs_work";
  return "critical";
}

// --- SEO -------------------------------------------------------------

function seoPageScore(page: StructuredSignals): number {
  const h1Score = page.h1Count === 1 ? 100 : 0;
  const metaScore = !page.metaDescription ? 0 : page.metaDescriptionLength >= 50 ? 100 : 50;
  const schemaScore = page.schemaTypes.length > 0 ? 100 : 0;
  const altScore =
    page.imagesTotal === 0
      ? 100
      : Math.round(100 * (1 - page.imagesMissingAlt / page.imagesTotal));
  return average([h1Score, metaScore, schemaScore, altScore]);
}

function computeSeoScore(pages: StructuredSignals[], coverage: SitemapCoverage): number {
  const base = average(pages.map(seoPageScore));
  const brokenPenalty = Math.min(30, coverage.brokenUrls.length * 5);
  return Math.max(0, Math.round(base - brokenPenalty));
}

function seoFindings(pages: StructuredSignals[], coverage: SitemapCoverage): PriorityItem[] {
  const findings: PriorityItem[] = [];

  for (const page of pages) {
    if (page.h1Count === 0) {
      findings.push({
        dimension: "seo",
        finding: `Missing H1 on ${page.url}`,
        impact: "medium",
        effort: "low",
        suggestedAction: "Add a single, descriptive H1 heading to the page.",
      });
    } else if (page.h1Count > 1) {
      findings.push({
        dimension: "seo",
        finding: `${page.h1Count} H1 tags on ${page.url}`,
        impact: "low",
        effort: "low",
        suggestedAction: "Keep exactly one H1 per page; demote the rest to H2/H3.",
      });
    }

    if (!page.metaDescription) {
      findings.push({
        dimension: "seo",
        finding: `Missing meta description on ${page.url}`,
        impact: "medium",
        effort: "low",
        suggestedAction: "Add a ~150-character meta description summarizing the page.",
      });
    } else if (page.metaDescriptionLength < 50) {
      findings.push({
        dimension: "seo",
        finding: `Meta description too short on ${page.url} (${page.metaDescriptionLength} chars)`,
        impact: "low",
        effort: "low",
        suggestedAction: "Expand the meta description to ~120-160 characters.",
      });
    }

    if (page.schemaTypes.length === 0) {
      findings.push({
        dimension: "seo",
        finding: `No schema.org markup on ${page.url}`,
        impact: "low",
        effort: "medium",
        suggestedAction: "Add JSON-LD structured data appropriate to the page type.",
      });
    }
  }

  const totalMissingAlt = pages.reduce((sum, p) => sum + p.imagesMissingAlt, 0);
  if (totalMissingAlt > 0) {
    findings.push({
      dimension: "seo",
      finding: `${totalMissingAlt} images missing alt text across ${pages.length} crawled pages`,
      impact: "low",
      effort: "low",
      suggestedAction: "Add descriptive alt text to every content image.",
    });
  }

  for (const broken of coverage.brokenUrls) {
    findings.push({
      dimension: "seo",
      finding: `Broken/unreachable sitemap URL: ${broken}`,
      impact: "medium",
      effort: "low",
      suggestedAction: "Fix or remove the broken URL from the sitemap.",
    });
  }

  return findings;
}

// --- GEO -------------------------------------------------------------

function geoPageScore(page: GeoSignals): number {
  const definitionScore = page.entityClarity.hasSelfContainedDefinition ? 100 : 0;
  const factualScore = page.factualDensity.score * 100;
  const eeatScore =
    (page.eeat.hasVisibleAuthor ? 33 : 0) +
    (page.eeat.hasPublishDate ? 33 : 0) +
    (page.eeat.hasUpdatedDate ? 34 : 0);
  const structureScore = page.extractableStructure.score * 100;
  return average([definitionScore, factualScore, eeatScore, structureScore]);
}

function computeGeoScore(pages: GeoSignals[]): number {
  return Math.round(average(pages.map(geoPageScore)));
}

function geoFindings(pages: GeoSignals[]): PriorityItem[] {
  const findings: PriorityItem[] = [];

  for (const page of pages) {
    if (!page.entityClarity.hasSelfContainedDefinition) {
      findings.push({
        dimension: "geo",
        finding: `No self-contained "what is this" definition on ${page.url}`,
        impact: "high",
        effort: "low",
        suggestedAction:
          'Add one self-contained sentence defining the product (e.g. in the meta description or opening paragraph) that an LLM can quote directly.',
      });
    }

    if (page.factualDensity.score < 0.4) {
      findings.push({
        dimension: "geo",
        finding: `Low factual density on ${page.url} (mostly promotional language)`,
        impact: "medium",
        effort: "medium",
        suggestedAction: "Replace vague adjectives with concrete numbers/comparisons.",
      });
    }

    if (!page.eeat.hasVisibleAuthor && !page.eeat.hasPublishDate) {
      findings.push({
        dimension: "geo",
        finding: `No visible author or publish date on ${page.url}`,
        impact: "medium",
        effort: "medium",
        suggestedAction: "Add a visible byline and publish/update date.",
      });
    }

    if (page.extractableStructure.score < 0.2) {
      findings.push({
        dimension: "geo",
        finding: `Little extractable structure on ${page.url} (no lists/tables/definitions)`,
        impact: "medium",
        effort: "medium",
        suggestedAction: "Break key content into lists, tables, or definition blocks.",
      });
    }
  }

  return findings;
}

// --- AEO -------------------------------------------------------------

function computeAeoScore(metrics: AeoMetrics, brand: string): number {
  const brandMetrics = metrics.perBrand.find((b) => b.brand === brand);
  if (!brandMetrics) return 0;
  const sovComponent = brandMetrics.shareOfVoice * 100;
  const sentimentComponent = ((brandMetrics.sentimentScore + 1) / 2) * 100;
  return Math.round(sovComponent * 0.6 + sentimentComponent * 0.4);
}

function aeoFindings(
  metrics: AeoMetrics,
  brand: string,
  crossValidationGaps: CrossValidationGap[]
): PriorityItem[] {
  const findings: PriorityItem[] = [];
  const brandMetrics = metrics.perBrand.find((b) => b.brand === brand);
  const competitorSov = metrics.perBrand
    .filter((b) => b.brand !== brand)
    .map((b) => b.shareOfVoice);
  const avgCompetitorSov = average(competitorSov);

  if (brandMetrics && brandMetrics.shareOfVoice < avgCompetitorSov) {
    findings.push({
      dimension: "aeo",
      finding: `${brand}'s Share of Voice (${(brandMetrics.shareOfVoice * 100).toFixed(0)}%) is below the competitor average (${(avgCompetitorSov * 100).toFixed(0)}%)`,
      impact: "high",
      effort: "high",
      suggestedAction:
        "Publish more citable, comparison-ready content (see GEO findings) to increase how often the model surfaces the brand.",
    });
  }

  if (brandMetrics && brandMetrics.sentimentScore < 0) {
    findings.push({
      dimension: "aeo",
      finding: `${brand} is mentioned with net-negative sentiment (${brandMetrics.sentimentScore.toFixed(2)})`,
      impact: "high",
      effort: "high",
      suggestedAction: "Investigate and address the specific negative associations found in the raw AEO runs.",
    });
  }

  if (brandMetrics && brandMetrics.firstMentionRate < 0.2 && brandMetrics.shareOfVoice > 0) {
    findings.push({
      dimension: "aeo",
      finding: `${brand} is rarely the first brand mentioned (${(brandMetrics.firstMentionRate * 100).toFixed(0)}% of runs)`,
      impact: "medium",
      effort: "high",
      suggestedAction: "Strengthen category-defining content to be the default recommendation, not an afterthought.",
    });
  }

  const uncoveredGaps = crossValidationGaps.filter((gap) => !gap.mentionedByModel);
  if (uncoveredGaps.length > 0) {
    const topGapTerms = uncoveredGaps.slice(0, 5).map((gap) => gap.term).join(", ");
    findings.push({
      dimension: "aeo",
      finding: `Top site keywords the model never uses when describing ${brand}: ${topGapTerms}`,
      impact: "medium",
      effort: "medium",
      suggestedAction: "Reinforce these terms in citable, structured site content so the model picks them up.",
    });
  }

  return findings;
}

function sortPriorities(items: PriorityItem[]): PriorityItem[] {
  const impactRank: Record<ImpactLevel, number> = { high: 0, medium: 1, low: 2 };
  const effortRank: Record<EffortLevel, number> = { low: 0, medium: 1, high: 2 };
  return [...items].sort((a, b) => {
    const impactDiff = impactRank[a.impact] - impactRank[b.impact];
    if (impactDiff !== 0) return impactDiff;
    return effortRank[a.effort] - effortRank[b.effort];
  });
}

export function buildReport(input: ReportInput): Report {
  const seoScoreValue = computeSeoScore(input.seoSignals, input.sitemapCoverage);
  const geoScoreValue = computeGeoScore(input.geoSignals);
  const aeoScoreValue = computeAeoScore(input.aeoMetrics, input.brand);

  const scores: DimensionScore[] = [
    { dimension: "seo", score: seoScoreValue, label: scoreLabel(seoScoreValue) },
    { dimension: "geo", score: geoScoreValue, label: scoreLabel(geoScoreValue) },
    { dimension: "aeo", score: aeoScoreValue, label: scoreLabel(aeoScoreValue) },
  ];

  const priorities = sortPriorities([
    ...seoFindings(input.seoSignals, input.sitemapCoverage),
    ...geoFindings(input.geoSignals),
    ...aeoFindings(input.aeoMetrics, input.brand, input.crossValidationGaps),
  ]);

  return {
    product: input.product,
    brand: input.brand,
    competitors: input.competitors,
    generatedAt: new Date().toISOString(),
    scores,
    seo: {
      pageCount: input.seoSignals.length,
      brokenUrlCount: input.sitemapCoverage.brokenUrls.length,
      topKeywords: input.tagcloud.site.slice(0, 15).map((t) => t.term),
    },
    geo: {
      pageCount: input.geoSignals.length,
      avgFactualDensityScore: average(input.geoSignals.map((g) => g.factualDensity.score)),
      avgExtractableStructureScore: average(
        input.geoSignals.map((g) => g.extractableStructure.score)
      ),
    },
    aeo: input.aeoMetrics,
    crossValidationGaps: input.crossValidationGaps,
    priorities,
    brandGrounded: input.brandGrounded,
  };
}

function scoreEmoji(label: ScoreLabel): string {
  return label === "good" ? "🟢" : label === "needs_work" ? "🟡" : "🔴";
}

export function renderReportMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# Brand Visibility Audit: ${report.brand}`);
  lines.push("");
  lines.push(`Generated ${report.generatedAt} · Competitors: ${report.competitors.join(", ")}`);
  lines.push("");
  lines.push("## Executive summary");
  lines.push("");
  for (const s of report.scores) {
    lines.push(`- ${scoreEmoji(s.label)} **${s.dimension.toUpperCase()}**: ${s.score}/100 (${s.label})`);
  }
  lines.push("");

  lines.push("## SEO");
  lines.push("");
  lines.push(`- Pages analyzed: ${report.seo.pageCount}`);
  lines.push(`- Broken sitemap URLs: ${report.seo.brokenUrlCount}`);
  lines.push(`- Top keywords: ${report.seo.topKeywords.join(", ")}`);
  lines.push("");

  lines.push("## GEO");
  lines.push("");
  lines.push(`- Avg factual density score: ${report.geo.avgFactualDensityScore.toFixed(2)}`);
  lines.push(`- Avg extractable structure score: ${report.geo.avgExtractableStructureScore.toFixed(2)}`);
  lines.push("");

  lines.push("## AEO");
  lines.push("");
  lines.push(`Total runs: ${report.aeo.totalRuns}`);
  lines.push("");
  lines.push("| Brand | Share of Voice | Relative SoV | Avg Position | First-Mention Rate | Sentiment |");
  lines.push("|---|---|---|---|---|---|");
  for (const b of report.aeo.perBrand) {
    lines.push(
      `| ${b.brand} | ${(b.shareOfVoice * 100).toFixed(0)}% | ${b.relativeShareOfVoice.toFixed(2)}x | ${
        b.averagePosition?.toFixed(1) ?? "—"
      } | ${(b.firstMentionRate * 100).toFixed(0)}% | ${b.sentimentScore.toFixed(2)} |`
    );
  }
  lines.push("");

  const uncovered = report.crossValidationGaps.filter((g) => !g.mentionedByModel);
  if (uncovered.length > 0) {
    lines.push(
      `**GEO/AEO gap**: ${uncovered.length} of the site's top ${report.crossValidationGaps.length} keywords never show up in how the model describes ${report.brand}: ${uncovered
        .slice(0, 10)
        .map((g) => g.term)
        .join(", ")}.`
    );
    lines.push("");
  }

  if (report.brandGrounded && report.brandGrounded.totalRuns > 0) {
    lines.push("## Brand-grounded question performance (not neutral -- see caveat)");
    lines.push("");
    lines.push(
      "Results from running user-question-generator's Part 1 (hook-grounded, quotes " +
        "the site) / Part 2 (inferential, paraphrased across pain_only/problem_framed/ " +
        "comparing_with_criteria) candidate questions through Gemini. These questions " +
        `are deliberately grounded in ${report.brand}'s own site content, not neutral -- ` +
        "do not compare these numbers to the neutral AEO table above as if they were " +
        "measuring the same thing; this section exists to show how the brand performs " +
        "on its *own best-case* questions, separately from fair category benchmarking."
    );
    lines.push("");
    lines.push(`Total runs: ${report.brandGrounded.totalRuns}`);
    lines.push("");
    lines.push("| Brand | Share of Voice | Relative SoV | Avg Position | First-Mention Rate | Sentiment |");
    lines.push("|---|---|---|---|---|---|");
    for (const b of report.brandGrounded.perBrand) {
      lines.push(
        `| ${b.brand} | ${(b.shareOfVoice * 100).toFixed(0)}% | ${b.relativeShareOfVoice.toFixed(2)}x | ${
          b.averagePosition?.toFixed(1) ?? "—"
        } | ${(b.firstMentionRate * 100).toFixed(0)}% | ${b.sentimentScore.toFixed(2)} |`
      );
    }
    lines.push("");

    const brandRow = report.brandGrounded.perBrand.find((b) => b.brand === report.brand);
    const sourceBreakdown = report.brandGrounded.byDimension.filter(
      (e) => e.dimension === "source" && e.brand === report.brand
    );
    const stageBreakdown = report.brandGrounded.byDimension.filter(
      (e) => e.dimension === "stage" && e.brand === report.brand
    );
    if (brandRow && (sourceBreakdown.length > 0 || stageBreakdown.length > 0)) {
      lines.push(`${report.brand}'s Share of Voice by breakdown:`);
      for (const e of [...sourceBreakdown, ...stageBreakdown]) {
        lines.push(
          `- ${e.dimension} = ${e.value}: ${(e.shareOfVoice * 100).toFixed(0)}% (${e.runCount} run${e.runCount === 1 ? "" : "s"})`
        );
      }
      lines.push("");
    }
  }

  lines.push("## Priority matrix (impact × effort)");
  lines.push("");
  lines.push("| Dimension | Finding | Impact | Effort | Suggested action |");
  lines.push("|---|---|---|---|---|");
  for (const p of report.priorities) {
    lines.push(
      `| ${p.dimension.toUpperCase()} | ${p.finding} | ${p.impact} | ${p.effort} | ${p.suggestedAction} |`
    );
  }
  lines.push("");

  return lines.join("\n");
}
