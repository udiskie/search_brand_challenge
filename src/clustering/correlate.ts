import type { CandidateQuestion, InferentialQuestion } from "../questionGenerator/types";
import { tokenize } from "../scraper/extractors/text";
import type { Theme, ThemeAnswerStats, ThemeQuestionRef } from "./types";

export interface CandidateQuestionsInput {
  hookQuestions: CandidateQuestion[];
  inferentialQuestions: InferentialQuestion[];
}

/**
 * Attaches every candidate question (Part 1 hook-grounded + Part 2
 * inferential) whose text shares a token with a theme's terms. A no-op
 * (themes returned unchanged) when `candidateQuestions` is undefined --
 * not every product has run `npm run questions` yet.
 */
export function correlateQuestions(
  themes: Theme[],
  candidateQuestions: CandidateQuestionsInput | undefined
): Theme[] {
  if (!candidateQuestions) return themes;

  return themes.map((theme) => {
    const termSet = new Set(theme.terms.map((t) => t.term));
    const questions: ThemeQuestionRef[] = [];

    for (const q of candidateQuestions.hookQuestions) {
      if (tokenize(q.text).some((token) => termSet.has(token))) {
        questions.push({ id: q.id, text: q.text, kind: "hook" });
      }
    }
    for (const q of candidateQuestions.inferentialQuestions) {
      if (tokenize(q.text).some((token) => termSet.has(token))) {
        questions.push({ id: q.id, text: q.text, kind: "inferential" });
      }
    }

    return { ...theme, questions };
  });
}

const CONTEXT_RADIUS = 60;
const MAX_SAMPLE_CONTEXTS = 3;

function contextWindow(text: string, index: number, termLength: number): string {
  const start = Math.max(0, index - CONTEXT_RADIUS);
  const end = Math.min(text.length, index + termLength + CONTEXT_RADIUS);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

/** First (by position) theme term found in `text`, with a context snippet around it. */
function firstMatchingSnippet(text: string, terms: Set<string>): string | undefined {
  const lower = text.toLowerCase();
  let best: { index: number; term: string } | undefined;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (!best || idx < best.index)) best = { index: idx, term };
  }
  return best ? contextWindow(text, best.index, best.term.length) : undefined;
}

/**
 * Tallies how many of Gemini's raw answers mention each theme's
 * vocabulary at all -- the clustering-level equivalent of the per-term
 * GEO gap crossValidate.ts already surfaces (does the model pick up what
 * the site emphasizes?). `field` selects which of a Theme's two answer
 * slots to fill (neutral AEO runs vs. brand-grounded runs) so this same
 * function correlates both sources without duplicating the loop.
 */
export function correlateAnswers(
  themes: Theme[],
  runs: { rawText: string | null }[],
  field: "neutralAnswers" | "brandGroundedAnswers"
): Theme[] {
  const validRuns = runs.filter(
    (r): r is { rawText: string } => r.rawText !== null
  );

  return themes.map((theme) => {
    const termSet = new Set(theme.terms.map((t) => t.term));
    let runsMentioning = 0;
    const sampleContexts: string[] = [];

    for (const run of validRuns) {
      const tokens = new Set(tokenize(run.rawText));
      const mentioned = [...termSet].some((term) => tokens.has(term));
      if (!mentioned) continue;

      runsMentioning++;
      if (sampleContexts.length < MAX_SAMPLE_CONTEXTS) {
        const snippet = firstMatchingSnippet(run.rawText, termSet);
        if (snippet) sampleContexts.push(snippet);
      }
    }

    const stats: ThemeAnswerStats = {
      runsScanned: validRuns.length,
      runsMentioning,
      sampleContexts,
    };
    return { ...theme, [field]: stats };
  });
}
