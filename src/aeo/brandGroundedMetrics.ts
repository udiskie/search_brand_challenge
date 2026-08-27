import { computeBrandMetrics, computeCoOccurrence, shareOfVoice } from "./aeoMetrics";
import type {
  BrandGroundedBreakdownEntry,
  BrandGroundedMetrics,
  BrandGroundedParsedRun,
} from "./types";

function computeSourceStageBreakdown(
  runs: BrandGroundedParsedRun[],
  allBrands: string[]
): BrandGroundedBreakdownEntry[] {
  const entries: BrandGroundedBreakdownEntry[] = [];

  const sources = new Set(runs.map((r) => r.source));
  for (const source of sources) {
    const subset = runs.filter((r) => r.source === source);
    for (const brand of allBrands) {
      entries.push({
        dimension: "source",
        value: source,
        brand,
        shareOfVoice: shareOfVoice(subset, brand),
        runCount: subset.length,
      });
    }
  }

  // Only inferential runs carry a stage.
  const stages = new Set(runs.map((r) => r.stage).filter((s): s is NonNullable<typeof s> => !!s));
  for (const stage of stages) {
    const subset = runs.filter((r) => r.stage === stage);
    for (const brand of allBrands) {
      entries.push({
        dimension: "stage",
        value: stage,
        brand,
        shareOfVoice: shareOfVoice(subset, brand),
        runCount: subset.length,
      });
    }
  }

  return entries;
}

/**
 * Same SoV/relative-SoV/position/first-mention/sentiment/co-occurrence
 * math as computeAeoMetrics() (reused directly, not duplicated), broken
 * down by prompt source (hook vs. inferential) and awareness stage
 * instead of the neutral pipeline's intent/persona/specificity/attribute/
 * language dimensions, since brand-grounded prompts don't carry those.
 */
export function computeBrandGroundedMetrics(
  runs: BrandGroundedParsedRun[],
  brand: string,
  competitors: string[]
): BrandGroundedMetrics {
  const allBrands = [brand, ...competitors];
  return {
    totalRuns: runs.length,
    perBrand: allBrands.map((b) => computeBrandMetrics(runs, b, allBrands)),
    coOccurrence: computeCoOccurrence(runs, allBrands),
    byDimension: computeSourceStageBreakdown(runs, allBrands),
  };
}
