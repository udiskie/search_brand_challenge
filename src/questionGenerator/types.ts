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

export interface InferentialQuestionTemplate {
  id: string;
  /** Contains `{problem}` and optionally `{audience}`/`{persona}` placeholders. */
  pattern: string;
  rationale: string;
}

export interface InferentialQuestion {
  id: string;
  text: string;
  templateId: string;
  problem: string;
  audience: string[];
  evidenceUrls: string[];
}
