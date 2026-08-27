export type ClusteringMethod = "taxonomy" | "llm";

export interface ThemeTerm {
  term: string;
  score: number;
  documentFrequency: number;
}

export interface ThemeQuestionRef {
  id: string;
  text: string;
  kind: "hook" | "inferential";
}

/** Evidence that a theme's vocabulary actually shows up in Gemini's answers. */
export interface ThemeAnswerStats {
  runsScanned: number;
  runsMentioning: number;
  /** Up to 3 context-window snippets around a matching term, for evidence. */
  sampleContexts: string[];
}

export interface Theme {
  name: string;
  terms: ThemeTerm[];
  questions: ThemeQuestionRef[];
  neutralAnswers: ThemeAnswerStats;
  brandGroundedAnswers: ThemeAnswerStats;
}

export interface ThemeClustering {
  product: string;
  method: ClusteringMethod;
  generatedAt: string;
  themes: Theme[];
  /** Terms that matched no theme -- kept explicit rather than force-fit. */
  unclustered: ThemeTerm[];
}
