import type {
  AeoMetrics,
  BrandMention,
  BrandMetrics,
  CoOccurrenceEntry,
  DimensionBreakdownEntry,
  ParsedRun,
  Sentiment,
} from "./types";

const SENTIMENT_SCORE: Record<Sentiment, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
};

/**
 * Any run shape with `mentions` -- both `ParsedRun` (neutral prompts) and
 * `BrandGroundedParsedRun` (Part 1/2 questions) satisfy this structurally,
 * so the core metric math below is shared between the two prompt sources
 * without either depending on the other's dimension shape.
 */
interface HasMentions {
  mentions: BrandMention[];
}

/** Share of Voice: fraction of runs in which `brand` is mentioned at all. */
export function shareOfVoice(runs: HasMentions[], brand: string): number {
  if (runs.length === 0) return 0;
  const mentioned = runs.filter((run) =>
    run.mentions.some((mention) => mention.brand === brand)
  ).length;
  return mentioned / runs.length;
}

export function computeBrandMetrics(
  runs: HasMentions[],
  brand: string,
  allBrands: string[]
): BrandMetrics {
  const totalRuns = runs.length;
  const sov = shareOfVoice(runs, brand);

  const others = allBrands.filter((b) => b !== brand);
  const othersSov = others.map((b) => shareOfVoice(runs, b));
  const avgOthersSov =
    others.length > 0 ? othersSov.reduce((a, b) => a + b, 0) / others.length : 0;
  // When no competitor is ever mentioned, dividing by their (zero) average
  // SoV would blow up to Infinity/NaN. Fall back to a floor of "one run's
  // worth of share" so a brand that IS mentioned still gets a finite,
  // clearly-dominant relative score instead of an undefined one.
  const floor = totalRuns > 0 ? 1 / totalRuns : 0;
  const relativeShareOfVoice = sov / (avgOthersSov || floor || 1);

  const mentionsOfBrand = runs.flatMap((run) =>
    run.mentions.filter((mention) => mention.brand === brand)
  );

  const averagePosition =
    mentionsOfBrand.length > 0
      ? mentionsOfBrand.reduce((sum, m) => sum + m.position, 0) / mentionsOfBrand.length
      : null;

  const firstMentionRate =
    totalRuns > 0
      ? runs.filter((run) => run.mentions[0]?.brand === brand).length / totalRuns
      : 0;

  const sentimentScore =
    mentionsOfBrand.length > 0
      ? mentionsOfBrand.reduce((sum, m) => sum + SENTIMENT_SCORE[m.sentiment], 0) /
        mentionsOfBrand.length
      : 0;

  return {
    brand,
    shareOfVoice: sov,
    relativeShareOfVoice,
    averagePosition,
    firstMentionRate,
    sentimentScore,
    mentionCount: mentionsOfBrand.length,
  };
}

export function computeCoOccurrence(runs: HasMentions[], allBrands: string[]): CoOccurrenceEntry[] {
  return allBrands.map((brand) => {
    const counts = new Map<string, number>();
    for (const run of runs) {
      const brandsInRun = new Set(run.mentions.map((m) => m.brand));
      if (!brandsInRun.has(brand)) continue;
      for (const other of brandsInRun) {
        if (other === brand) continue;
        counts.set(other, (counts.get(other) ?? 0) + 1);
      }
    }
    const coOccursWith = [...counts.entries()]
      .map(([otherBrand, count]) => ({ brand: otherBrand, count }))
      .sort((a, b) => b.count - a.count);
    return { brand, coOccursWith };
  });
}

const DIMENSION_GETTERS: {
  dimension: DimensionBreakdownEntry["dimension"];
  getValue: (run: ParsedRun) => string;
}[] = [
  { dimension: "intent", getValue: (r) => r.dimensions.intent },
  { dimension: "persona", getValue: (r) => r.dimensions.persona.role },
  { dimension: "specificity", getValue: (r) => r.dimensions.specificity },
  { dimension: "attribute", getValue: (r) => r.dimensions.attribute },
  { dimension: "language", getValue: (r) => r.dimensions.language },
];

function computeDimensionBreakdown(
  runs: ParsedRun[],
  allBrands: string[]
): DimensionBreakdownEntry[] {
  const entries: DimensionBreakdownEntry[] = [];

  for (const { dimension, getValue } of DIMENSION_GETTERS) {
    const values = new Set(runs.map(getValue));
    for (const value of values) {
      const subset = runs.filter((run) => getValue(run) === value);
      for (const brand of allBrands) {
        entries.push({
          dimension,
          value,
          brand,
          shareOfVoice: shareOfVoice(subset, brand),
          runCount: subset.length,
        });
      }
    }
  }

  return entries;
}

export function computeAeoMetrics(
  runs: ParsedRun[],
  brand: string,
  competitors: string[]
): AeoMetrics {
  const allBrands = [brand, ...competitors];
  return {
    totalRuns: runs.length,
    perBrand: allBrands.map((b) => computeBrandMetrics(runs, b, allBrands)),
    coOccurrence: computeCoOccurrence(runs, allBrands),
    byDimension: computeDimensionBreakdown(runs, allBrands),
  };
}
