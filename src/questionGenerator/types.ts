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
