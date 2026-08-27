import type { CandidateQuestion, InferentialQuestion } from "../questionGenerator/types";
import type { BrandGroundedPrompt } from "./types";

/** Part 1 (hook-grounded) candidate questions -> Gemini-callable prompts. */
export function hookQuestionsToPrompts(questions: CandidateQuestion[]): BrandGroundedPrompt[] {
  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    source: "hook",
    templateId: q.templateId,
  }));
}

/** Part 2 (inferential) candidate questions -> Gemini-callable prompts. */
export function inferentialQuestionsToPrompts(
  questions: InferentialQuestion[]
): BrandGroundedPrompt[] {
  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    source: "inferential",
    templateId: q.templateId,
    stage: q.stage,
  }));
}
