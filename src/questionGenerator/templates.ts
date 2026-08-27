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
 *
 * Hooks come in two shapes -- a short phrase (a tagcloud term like "cycles")
 * or a full sentence (a meta description/GEO definition) -- and need
 * different templates: splicing a whole sentence into a template built for
 * a short phrase reads as broken English (discovered running this against
 * real scraped data). SHORT_PHRASE_TEMPLATES assume a noun-phrase-sized
 * `{hook}`; LONG_FORM_TEMPLATES quote a full-sentence `{hook}` directly.
 */
export const SHORT_PHRASE_TEMPLATES: QuestionTemplate[] = [
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

export const LONG_FORM_TEMPLATES: QuestionTemplate[] = [
  {
    id: "long-form-quote-match",
    pattern: 'What tool matches this description: "{hook}"?',
    rationale:
      "Quotes a full positioning statement directly rather than splicing it into a shorter template, which reads as broken English for sentence-length hooks.",
  },
  {
    id: "long-form-as-need",
    pattern: "As {persona}, I'm looking for a tool where: {hook} Any suggestions?",
    rationale:
      "Treats the site's own sentence as the user's stated need verbatim -- works when the sentence is already need-shaped, with a persona constraint added.",
  },
];

export const DEFAULT_PERSONAS = [
  "an engineering lead",
  "a startup founder",
  "a product manager at a large company",
  "a freelancer",
];

/** Sentence-length hooks (meta descriptions, GEO definitions) need the long-form templates. */
const LONG_FORM_WORD_THRESHOLD = 6;

function isLongForm(hook: string): boolean {
  return hook.trim().split(/\s+/).length > LONG_FORM_WORD_THRESHOLD;
}

function fillTemplate(pattern: string, hook: string, persona: string): string {
  return pattern.replace("{hook}", hook).replace("{persona}", persona);
}

/**
 * Combines scanned hooks with the question templates to produce candidate
 * user questions, picking short-phrase vs. long-form templates per hook.
 * Each question carries its originating hook and evidence URLs so a
 * reviewer can check the grounding before using it.
 */
export function generateCandidateQuestions(
  hooks: ProductHook[],
  shortPhraseTemplates: QuestionTemplate[] = SHORT_PHRASE_TEMPLATES,
  longFormTemplates: QuestionTemplate[] = LONG_FORM_TEMPLATES
): CandidateQuestion[] {
  const questions: CandidateQuestion[] = [];
  let counter = 0;

  for (const hook of hooks) {
    const templates = isLongForm(hook.hook) ? longFormTemplates : shortPhraseTemplates;
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
