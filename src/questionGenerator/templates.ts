import type { CandidateQuestion, ProductHook, QuestionTemplate } from "./types";

/**
 * Templates for realistic END-USER questions -- the kind someone actually
 * types into an AI assistant -- grounded in a product's own scanned
 * positioning. This is the opposite goal of src/aeo/promptGenerator.ts's
 * templates: that generator produces *neutral, balanced* prompts across a
 * category to fairly benchmark Share of Voice against competitors. These
 * templates deliberately lean on a brand's own distinctive language to
 * surface the specific real-world questions where its own content gives it
 * the best shot at being the model's answer.
 */
export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  {
    id: "direct-differentiator",
    pattern: 'What tool would you recommend for a team that wants "{hook}"?',
    rationale:
      "Quotes the brand's own positioning language back as a stated need -- if the phrase is genuinely distinctive to the brand, it's often the best-fitting answer.",
  },
  {
    id: "problem-framed",
    pattern: "I need something that helps with {hook} -- what should my team use?",
    rationale:
      "Frames the differentiator as a problem/need rather than a feature list, closer to how real users phrase requests to an assistant.",
  },
  {
    id: "comparison-anchor",
    pattern: "Which tool in this space is known for {hook}?",
    rationale:
      "Anchors the question on the specific claim, prompting the model to recall which brand it associates with that trait.",
  },
  {
    id: "persona-specific",
    pattern:
      "As {persona}, I want a tool that focuses on {hook} instead of doing everything. Any recommendations?",
    rationale:
      "Adds a persona constraint (mirrors WORK_PLAN.md's AEO persona dimension) so the same hook can be probed across different user contexts.",
  },
];

const DEFAULT_PERSONAS = [
  "an engineering lead",
  "a startup founder",
  "a product manager at a large company",
  "a freelancer",
];

function fillTemplate(pattern: string, hook: string, persona: string): string {
  return pattern.replace("{hook}", hook).replace("{persona}", persona);
}

/**
 * Combines scanned hooks with the question templates to produce candidate
 * user questions. Each question carries its originating hook and evidence
 * URLs so a reviewer can check the grounding before using it.
 */
export function generateCandidateQuestions(
  hooks: ProductHook[],
  templates: QuestionTemplate[] = QUESTION_TEMPLATES
): CandidateQuestion[] {
  const questions: CandidateQuestion[] = [];
  let counter = 0;

  for (const hook of hooks) {
    for (const template of templates) {
      const persona = DEFAULT_PERSONAS[counter % DEFAULT_PERSONAS.length];
      questions.push({
        id: `${template.id}-${counter++}`,
        text: fillTemplate(template.pattern, hook.hook, persona),
        templateId: template.id,
        hook: hook.hook,
        hookSource: hook.source,
        evidenceUrls: hook.evidence.map((e) => e.url),
      });
    }
  }

  return questions;
}
