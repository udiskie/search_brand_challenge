import type { AwarenessStage } from "../questionGenerator/types";

export type PromptIntent =
  | "discovery"
  | "direct_comparison"
  | "recommendation_constraint"
  | "troubleshooting_replacement"
  | "final_decision"
  | "adversarial_control";

export type Specificity = "generic" | "semi_specific" | "specific";

export type AttributeAnchor =
  | "price"
  | "speed_ux"
  | "integrations"
  | "methodology"
  | "none";

export type PromptLanguage = "en" | "es";

export interface Persona {
  role: string;
  teamSize: string;
}

export interface PromptDimensions {
  intent: PromptIntent;
  persona: Persona;
  specificity: Specificity;
  attribute: AttributeAnchor;
  language: PromptLanguage;
  brandsNamed: string[];
}

export interface GeneratedPrompt {
  id: string;
  text: string;
  dimensions: PromptDimensions;
}

export interface AeoAuditConfig {
  brand: string;
  competitors: string[];
  category: string;
  promptCount: number;
  runsPerPrompt: number;
  temperature: number;
  model: string;
}

export interface GeminiRunResult {
  runId: string;
  promptId: string;
  promptText: string;
  dimensions: PromptDimensions;
  temperature: number;
  timestamp: string;
  finishReason: string | null;
  rawText: string | null;
  error?: string;
}

export type MentionRole =
  | "recommended_first"
  | "mentioned"
  | "compared"
  | "discarded";

export type Sentiment = "positive" | "neutral" | "negative";

export interface BrandMention {
  brand: string;
  position: number;
  role: MentionRole;
  sentiment: Sentiment;
  context: string;
}

export interface ParsedRun {
  runId: string;
  promptId: string;
  dimensions: PromptDimensions;
  mentions: BrandMention[];
}

export interface BrandMetrics {
  brand: string;
  shareOfVoice: number;
  relativeShareOfVoice: number;
  averagePosition: number | null;
  firstMentionRate: number;
  sentimentScore: number;
  mentionCount: number;
}

export interface DimensionBreakdownEntry {
  dimension: "intent" | "persona" | "specificity" | "attribute" | "language";
  value: string;
  brand: string;
  shareOfVoice: number;
  runCount: number;
}

export interface CoOccurrenceEntry {
  brand: string;
  coOccursWith: { brand: string; count: number }[];
}

export interface AeoMetrics {
  totalRuns: number;
  perBrand: BrandMetrics[];
  coOccurrence: CoOccurrenceEntry[];
  byDimension: DimensionBreakdownEntry[];
}

export interface CrossValidationGap {
  term: string;
  siteScore: number;
  mentionedByModel: boolean;
}

export type ReportDimension = "seo" | "geo" | "aeo";
export type ImpactLevel = "high" | "medium" | "low";
export type EffortLevel = "high" | "medium" | "low";
export type ScoreLabel = "good" | "needs_work" | "critical";

export interface PriorityItem {
  dimension: ReportDimension;
  finding: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  suggestedAction: string;
}

export interface DimensionScore {
  dimension: ReportDimension;
  score: number;
  label: ScoreLabel;
}

export interface Report {
  product: string;
  brand: string;
  competitors: string[];
  generatedAt: string;
  scores: DimensionScore[];
  seo: {
    pageCount: number;
    brokenUrlCount: number;
    topKeywords: string[];
  };
  geo: {
    pageCount: number;
    avgFactualDensityScore: number;
    avgExtractableStructureScore: number;
  };
  aeo: AeoMetrics;
  crossValidationGaps: CrossValidationGap[];
  priorities: PriorityItem[];
  /**
   * Optional: results from running brand-grounded questions (from
   * user-question-generator's Part 1/Part 2) through Gemini. Deliberately
   * separate from `aeo` (the neutral benchmarking metrics) rather than
   * merged in -- see brand-visibility-audit's SKILL.md and DECISIONS.md's
   * persona-inference-neutrality entry for why brand-grounded and neutral
   * prompt sources shouldn't be blended into one metric. Never feeds into
   * `scores`/`priorities`.
   */
  brandGrounded?: BrandGroundedMetrics;
}

/**
 * A candidate question from user-question-generator (`src/questionGenerator/`)
 * adapted into something `runGeminiForBrandGroundedPrompts` can send to
 * Gemini. "hook" = Part 1 (quotes/echoes the site's own phrasing);
 * "inferential" = Part 2 (paraphrased, across the awareness-ladder stages).
 */
export type BrandGroundedSource = "hook" | "inferential";

export interface BrandGroundedPrompt {
  id: string;
  text: string;
  source: BrandGroundedSource;
  templateId: string;
  /** Only set for source: "inferential". */
  stage?: AwarenessStage;
}

export interface BrandGroundedRunResult {
  runId: string;
  promptId: string;
  promptText: string;
  source: BrandGroundedSource;
  templateId: string;
  stage?: AwarenessStage;
  temperature: number;
  timestamp: string;
  finishReason: string | null;
  rawText: string | null;
  error?: string;
}

export interface BrandGroundedParsedRun {
  runId: string;
  promptId: string;
  source: BrandGroundedSource;
  stage?: AwarenessStage;
  mentions: BrandMention[];
}

export interface BrandGroundedBreakdownEntry {
  dimension: "source" | "stage";
  value: string;
  brand: string;
  shareOfVoice: number;
  runCount: number;
}

export interface BrandGroundedMetrics {
  totalRuns: number;
  perBrand: BrandMetrics[];
  coOccurrence: CoOccurrenceEntry[];
  byDimension: BrandGroundedBreakdownEntry[];
}
