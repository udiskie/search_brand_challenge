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
}
