import { DEFAULT_PERSONAS } from "./templates";
import type {
  AudienceSignal,
  InferentialQuestion,
  InferentialQuestionTemplate,
  ProblemClaim,
} from "./types";

/**
 * Templates that never quote the site -- they phrase the extracted
 * problem (and, where detected, audience) as the user's own stated need,
 * at three points on the awareness ladder:
 *
 * 1. `pain_only` -- describes a symptom/frustration, no solution ask at
 *    all. Tests whether the model proactively surfaces the brand even
 *    when not explicitly asked to recommend anything.
 * 2. `problem_framed` -- has named the problem, doesn't yet know the
 *    *type* of solution ("what's the best way", not "what tool").
 * 3. `comparing_with_criteria` -- already solution-aware, wants named
 *    options evaluated against criteria derived from their own pain
 *    point (named-competitor variants only generated when >=2
 *    competitors are supplied).
 *
 * All three read naturally because the problem clause is always a bare,
 * infinitive-compatible verb phrase (see problemAudienceScanner.ts's verb
 * normalization) -- every template embeds it after "to".
 */
export const PAIN_ONLY_TEMPLATES: InferentialQuestionTemplate[] = [
  {
    id: "pain-vent",
    stage: "pain_only",
    pattern: "As {persona}, my team keeps struggling to {problem}.",
    rationale:
      "Pure symptom statement with no solution ask -- the strongest test of whether the model proactively surfaces the brand unprompted.",
  },
  {
    id: "pain-frustration",
    stage: "pain_only",
    pattern: "We can never seem to {problem} -- it's honestly exhausting.",
    rationale: "First-person frustration, no request for a recommendation.",
  },
  {
    id: "pain-recurring",
    stage: "pain_only",
    pattern: "Every week it's the same story: we just can't {problem}.",
    rationale: "Recurring-complaint framing, still no solution ask.",
  },
];

export const PAIN_ONLY_AUDIENCE_TEMPLATES: InferentialQuestionTemplate[] = [
  {
    id: "pain-vent-audience",
    stage: "pain_only",
    pattern: "For {audience}, it's a constant challenge to {problem}.",
    rationale: "Same pain-only framing, generalized to the detected audience instead of one speaker.",
    requiresAudience: true,
  },
];

export const PROBLEM_FRAMED_TEMPLATES: InferentialQuestionTemplate[] = [
  {
    id: "problem-best-way",
    stage: "problem_framed",
    pattern: "What's the best way to {problem}?",
    rationale:
      "Open-ended \"way\", not \"tool\" -- leaves room for a non-product answer, unlike the comparing-stage templates.",
  },
  {
    id: "problem-how-to",
    stage: "problem_framed",
    pattern: "How do most teams manage to {problem}?",
    rationale: "Asks how others solve it, without presupposing a specific solution category.",
  },
  {
    id: "problem-advice",
    stage: "problem_framed",
    pattern: "We know we need to {problem}, but we're not sure how. Any advice?",
    rationale: "Explicit problem framing plus solution-uncertainty, phrased as a real user would ask for help.",
  },
];

export const PROBLEM_FRAMED_AUDIENCE_TEMPLATES: InferentialQuestionTemplate[] = [
  {
    id: "problem-audience-way",
    stage: "problem_framed",
    pattern: "What's the best way for {audience} to {problem}?",
    rationale: "Same open framing, scoped to the detected audience.",
    requiresAudience: true,
  },
];

export const COMPARISON_TEMPLATES: InferentialQuestionTemplate[] = [
  {
    id: "comparison-criteria-generic",
    stage: "comparing_with_criteria",
    pattern: "What criteria matter most when picking a tool to help {problem}?",
    rationale:
      "Solution-aware and evaluating, but with no named options -- tests whether the model's own criteria list favors the brand.",
  },
];

export const COMPARISON_AUDIENCE_TEMPLATES: InferentialQuestionTemplate[] = [
  {
    id: "comparison-criteria-audience",
    stage: "comparing_with_criteria",
    pattern: "What should I prioritize when choosing a tool for {audience} that need to {problem}?",
    rationale: "Criteria-based comparison scoped to the detected audience.",
    requiresAudience: true,
  },
];

export const COMPARISON_NAMED_TEMPLATES: InferentialQuestionTemplate[] = [
  {
    id: "comparison-named",
    stage: "comparing_with_criteria",
    pattern: "Between {competitorA} and {competitorB}, which is better suited to help {problem}?",
    rationale:
      "Forces a real comparison against named alternatives using a pain-derived criterion -- the closest analogue to how a solution-aware user actually asks.",
    requiresCompetitors: true,
  },
];

export const COMPARISON_NAMED_AUDIENCE_TEMPLATES: InferentialQuestionTemplate[] = [
  {
    id: "comparison-named-audience",
    stage: "comparing_with_criteria",
    pattern: "Between {competitorA} and {competitorB}, which is better for {audience} that need to {problem}?",
    rationale: "Named comparison scoped to the detected audience.",
    requiresAudience: true,
    requiresCompetitors: true,
  },
];

function pickAudiencePhrase(audience: AudienceSignal): string | null {
  return audience.userTypes[0] ?? audience.orgTypes[0] ?? null;
}

function fillTemplate(
  pattern: string,
  problem: string,
  audience: string,
  persona: string,
  competitorA: string,
  competitorB: string
): string {
  return pattern
    .replace("{problem}", problem)
    .replace("{audience}", audience)
    .replace("{persona}", persona)
    .replace("{competitorA}", competitorA)
    .replace("{competitorB}", competitorB);
}

/**
 * Combines scanned problem/audience claims with the awareness-stage
 * templates. Audience-requiring templates only apply when a claim has a
 * detected audience signal; named-comparison templates only apply when
 * at least two named competitors are supplied -- so no template ever
 * plugs in an empty placeholder.
 */
export function generateInferentialQuestions(
  claims: ProblemClaim[],
  competitors: string[] = []
): InferentialQuestion[] {
  const questions: InferentialQuestion[] = [];
  let counter = 0;
  const [competitorA, competitorB] = competitors;
  const hasNamedCompetitors = competitors.length >= 2;

  for (const claim of claims) {
    const audiencePhrase = pickAudiencePhrase(claim.audience);
    const audienceList = [...claim.audience.userTypes, ...claim.audience.orgTypes];

    const applicableTemplates: InferentialQuestionTemplate[] = [
      ...PAIN_ONLY_TEMPLATES,
      ...(audiencePhrase ? PAIN_ONLY_AUDIENCE_TEMPLATES : []),
      ...PROBLEM_FRAMED_TEMPLATES,
      ...(audiencePhrase ? PROBLEM_FRAMED_AUDIENCE_TEMPLATES : []),
      ...(audiencePhrase ? COMPARISON_AUDIENCE_TEMPLATES : COMPARISON_TEMPLATES),
      ...(hasNamedCompetitors
        ? audiencePhrase
          ? COMPARISON_NAMED_AUDIENCE_TEMPLATES
          : COMPARISON_NAMED_TEMPLATES
        : []),
    ];

    for (const template of applicableTemplates) {
      const persona = DEFAULT_PERSONAS[counter % DEFAULT_PERSONAS.length];
      questions.push({
        id: `${template.id}-${counter++}`,
        text: fillTemplate(
          template.pattern,
          claim.problem,
          audiencePhrase ?? "",
          persona,
          competitorA ?? "",
          competitorB ?? ""
        ),
        templateId: template.id,
        stage: template.stage,
        problem: claim.problem,
        audience: audienceList,
        evidenceUrls: claim.evidence.map((e) => e.url),
      });
    }
  }

  return questions;
}
