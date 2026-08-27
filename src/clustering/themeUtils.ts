import type { TagcloudTerm } from "../scraper/types";
import type { Theme, ThemeTerm } from "./types";

const EMPTY_ANSWER_STATS = { runsScanned: 0, runsMentioning: 0, sampleContexts: [] };

export function toThemeTerm(term: TagcloudTerm): ThemeTerm {
  return { term: term.term, score: term.score, documentFrequency: term.documentFrequency };
}

/** Builds a fresh Theme from a name + its terms, with empty (not-yet-correlated) question/answer slots. */
export function buildTheme(name: string, terms: ThemeTerm[]): Theme {
  return {
    name,
    terms: [...terms].sort((a, b) => b.score - a.score),
    questions: [],
    neutralAnswers: { ...EMPTY_ANSWER_STATS, sampleContexts: [] },
    brandGroundedAnswers: { ...EMPTY_ANSWER_STATS, sampleContexts: [] },
  };
}

/** Highest combined term score first -- consistent ordering across both clustering methods. */
export function sortThemesByScore(themes: Theme[]): Theme[] {
  return [...themes].sort((a, b) => {
    const aTotal = a.terms.reduce((sum, t) => sum + t.score, 0);
    const bTotal = b.terms.reduce((sum, t) => sum + t.score, 0);
    return bTotal - aTotal;
  });
}
