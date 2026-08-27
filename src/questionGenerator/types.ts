export type HookSource =
  | "meta_description"
  | "geo_definition"
  | "tagcloud";

export interface HookEvidence {
  url: string;
  snippet: string;
}

/**
 * A "hook" is a scanned, evidence-backed piece of a product's own
 * positioning -- a phrase or keyword pulled from its site, not invented.
 * Question templates plug hooks in to ground candidate questions in what
 * the product's own content actually claims about itself.
 */
export interface ProductHook {
  hook: string;
  source: HookSource;
  documentFrequency: number;
  evidence: HookEvidence[];
}

export interface QuestionTemplate {
  id: string;
  /** Contains `{hook}` and optionally `{persona}` placeholders. */
  pattern: string;
  /** Why this phrasing tends to make a model surface the specific brand. */
  rationale: string;
}

export interface CandidateQuestion {
  id: string;
  text: string;
  templateId: string;
  hook: string;
  hookSource: HookSource;
  evidenceUrls: string[];
}

/** An org type ("startup") or user/role type ("engineering team") the site names as who it's for. */
export interface AudienceSignal {
  orgTypes: string[];
  userTypes: string[];
}

/**
 * A problem the product claims to solve, extracted (not quoted verbatim
 * in generated questions) from action-oriented sentences on the site --
 * "helps teams X", "reduces Y", "lets you Z" -- paired with whichever
 * audience terms co-occur in the same source text. Unlike ProductHook,
 * this is meant to be paraphrased into a natural user need, not quoted.
 */
export interface ProblemClaim {
  problem: string;
  audience: AudienceSignal;
  evidence: HookEvidence[];
}

/**
 * Where the asker is on the awareness ladder, from least to most
 * articulated:
 * - `pain_only`: describes a symptom/frustration, no solution ask at all.
 * - `problem_framed`: has named the problem, doesn't know how to solve it
 *   (open "what's the best way", not "what tool").
 * - `comparing_with_criteria`: knows they want a tool, wants named options
 *   evaluated against criteria derived from their own pain point.
 */
export type AwarenessStage = "pain_only" | "problem_framed" | "comparing_with_criteria";

export interface InferentialQuestionTemplate {
  id: string;
  stage: AwarenessStage;
  /** Contains `{problem}` and optionally `{audience}`/`{persona}`/`{competitorA}`/`{competitorB}` placeholders. */
  pattern: string;
  rationale: string;
  /** Only usable when the claim has a detected audience signal. */
  requiresAudience?: boolean;
  /** Only usable when at least two named competitors were supplied. */
  requiresCompetitors?: boolean;
}

export interface InferentialQuestion {
  id: string;
  text: string;
  templateId: string;
  stage: AwarenessStage;
  problem: string;
  audience: string[];
  evidenceUrls: string[];
}
