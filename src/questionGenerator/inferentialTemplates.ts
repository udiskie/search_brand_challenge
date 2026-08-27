import { DEFAULT_PERSONAS } from "./templates";
import type { AudienceSignal, InferentialQuestion, InferentialQuestionTemplate, ProblemClaim } from "./types";

/**
 * Templates that never quote the site -- they phrase the extracted
 * problem (and, where detected, audience) as the user's own stated need.
 * The point is to make the model *infer* the brand from problem/audience
 * fit rather than pattern-match a quoted phrase, which is the weakness
 * SKILL.md documents for the direct-hook templates in templates.ts (a
 * "pass" there can just mean the model recognized a literal sentence it
 * indexed, not that it reasoned about fit).
 */
export const UNIVERSAL_TEMPLATES: InferentialQuestionTemplate[] = [
  {
    id: "persona-problem",
    pattern: "As {persona}, I'm trying to {problem}. What should I use?",
    rationale:
      "First-person need phrased entirely in generic terms -- no audience or brand-specific language, so any match requires genuine inference.",
  },
  {
    id: "generic-problem-only",
    pattern: "What's a good way to {problem}?",
    rationale:
      "Used when no audience was detected for a claim -- keeps the question natural rather than forcing an audience phrase that isn't there.",
  },
];

/** Only used when a claim has a detected audience signal to plug in. */
export const AUDIENCE_TEMPLATES: InferentialQuestionTemplate[] = [
  {
    id: "problem-for-audience",
    pattern: "What tool would you recommend for {audience} that need to {problem}?",
    rationale:
      "Combines the inferred audience and problem without any brand-specific wording -- the closer analogue to how a real user actually asks.",
  },
  {
    id: "audience-fit-question",
    pattern: "Is there a tool built specifically for {audience} to {problem}?",
    rationale:
      "Tests whether the model associates this problem+audience combination with a specific brand, rather than defaulting to a generic category answer.",
  },
];

function pickAudiencePhrase(audience: AudienceSignal): string | null {
  return audience.userTypes[0] ?? audience.orgTypes[0] ?? null;
}

function fillTemplate(pattern: string, problem: string, audience: string, persona: string): string {
  return pattern
    .replace("{problem}", problem)
    .replace("{audience}", audience)
    .replace("{persona}", persona);
}

/**
 * Combines scanned problem/audience claims with the inferential templates.
 * Claims with no detected audience only get the audience-free templates
 * (never an empty "{audience}" plugged into a sentence that needs one).
 */
export function generateInferentialQuestions(
  claims: ProblemClaim[],
  universalTemplates: InferentialQuestionTemplate[] = UNIVERSAL_TEMPLATES,
  audienceTemplates: InferentialQuestionTemplate[] = AUDIENCE_TEMPLATES
): InferentialQuestion[] {
  const questions: InferentialQuestion[] = [];
  let counter = 0;

  for (const claim of claims) {
    const audiencePhrase = pickAudiencePhrase(claim.audience);
    const applicableTemplates = audiencePhrase
      ? [...universalTemplates, ...audienceTemplates]
      : universalTemplates;

    for (const template of applicableTemplates) {
      const persona = DEFAULT_PERSONAS[counter % DEFAULT_PERSONAS.length];
      questions.push({
        id: `${template.id}-${counter++}`,
        text: fillTemplate(template.pattern, claim.problem, audiencePhrase ?? "", persona),
        templateId: template.id,
        problem: claim.problem,
        audience: [...claim.audience.userTypes, ...claim.audience.orgTypes],
        evidenceUrls: claim.evidence.map((e) => e.url),
      });
    }
  }

  return questions;
}
