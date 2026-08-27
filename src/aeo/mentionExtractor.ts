import type {
  BrandMention,
  GeminiRunResult,
  MentionRole,
  ParsedRun,
  Sentiment,
} from "./types";

const POSITIVE_WORDS = [
  "best", "great", "excellent", "recommend", "recommended", "top", "fast",
  "simple", "powerful", "favorite", "ideal", "loved", "intuitive",
  "recomendado", "mejor", "excelente", "rapido", "simple", "ideal",
];

const NEGATIVE_WORDS = [
  "worst", "avoid", "outdated", "slow", "clunky", "expensive", "complicated",
  "discontinued", "bloated", "buggy",
  "peor", "evitar", "lento", "complicado", "caro", "descontinuado",
];

const COMPARISON_WORDS = [
  "vs", "versus", "compared", "compare", "alternative", "instead of",
  "alternativa", "comparado", "frente a", "en lugar de",
];

const DISCARD_WORDS = [
  "not recommend", "wouldn't recommend", "steer clear", "no recomendar",
  "no recomiendo", "no recomendaria",
];

function findAllIndices(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const indices: number[] = [];
  const lowerHay = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let idx = lowerHay.indexOf(lowerNeedle);
  while (idx !== -1) {
    indices.push(idx);
    idx = lowerHay.indexOf(lowerNeedle, idx + lowerNeedle.length);
  }
  return indices;
}

function contextWindow(
  text: string,
  index: number,
  needleLength: number,
  radius = 60
): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + needleLength + radius);
  return text.slice(start, end);
}

function containsAny(lowerText: string, words: string[]): boolean {
  return words.some((word) => lowerText.includes(word));
}

function scoreSentiment(context: string): Sentiment {
  const lower = context.toLowerCase();
  const positive = containsAny(lower, POSITIVE_WORDS);
  const negative = containsAny(lower, NEGATIVE_WORDS);
  if (positive && !negative) return "positive";
  if (negative && !positive) return "negative";
  return "neutral";
}

function classifyRole(context: string, isFirstBrandMentioned: boolean): MentionRole {
  const lower = context.toLowerCase();
  if (containsAny(lower, DISCARD_WORDS)) return "discarded";
  if (containsAny(lower, COMPARISON_WORDS)) return "compared";
  if (isFirstBrandMentioned) return "recommended_first";
  return "mentioned";
}

/**
 * Heuristic (keyword/regex, not a second LLM call) extraction of brand
 * mentions from a raw Gemini response: which brands appear, in what
 * order (by first occurrence), with what sentiment/role. This is a
 * documented simplification vs. an LLM-based extractor -- see
 * SKILL.md's "Known limitations" section.
 */
export function extractMentions(text: string, brands: string[]): BrandMention[] {
  const firstIndexByBrand = new Map<string, number>();
  for (const brand of brands) {
    const indices = findAllIndices(text, brand);
    if (indices.length > 0) firstIndexByBrand.set(brand, indices[0]);
  }

  const orderedBrands = [...firstIndexByBrand.entries()].sort((a, b) => a[1] - b[1]);

  return orderedBrands.map(([brand, index], position): BrandMention => {
    const context = contextWindow(text, index, brand.length);
    const role = classifyRole(context, position === 0);
    // A "discarded" construct (e.g. "would not recommend X") often still
    // contains a positive-looking word like "recommend" -- treat it as
    // negative outright rather than let word-counting call it neutral.
    const sentiment: Sentiment = role === "discarded" ? "negative" : scoreSentiment(context);
    return { brand, position: position + 1, role, sentiment, context };
  });
}

export function parseRun(run: GeminiRunResult, brands: string[]): ParsedRun {
  return {
    runId: run.runId,
    promptId: run.promptId,
    dimensions: run.dimensions,
    mentions: run.rawText ? extractMentions(run.rawText, brands) : [],
  };
}
