import { KNOWN_SCRAPE_ARTIFACTS } from "../questionGenerator/datalakeScanner";
import type { TagcloudTerm } from "../scraper/types";
import { CATEGORY_THEMES } from "./taxonomy";
import { buildTheme, sortThemesByScore, toThemeTerm } from "./themeUtils";
import type { Theme, ThemeTerm } from "./types";

/**
 * Buckets tagcloud terms into the hand-curated taxonomy (src/clustering/
 * taxonomy.ts). Each term goes to the first theme whose keyword list
 * contains it -- keyword lists are unique across themes (verified), so
 * assignment doesn't actually depend on iteration order. Known scrape
 * artifacts are dropped outright, same as user-question-generator does
 * for hooks; everything else that matches no theme lands in
 * `unclustered` rather than being force-fit.
 */
export function clusterTermsByTaxonomy(tagcloud: TagcloudTerm[]): {
  themes: Theme[];
  unclustered: ThemeTerm[];
} {
  const themeByKeyword = new Map<string, string>();
  for (const [themeName, keywords] of Object.entries(CATEGORY_THEMES)) {
    for (const keyword of keywords) themeByKeyword.set(keyword, themeName);
  }

  const termsByTheme = new Map<string, ThemeTerm[]>();
  const unclustered: ThemeTerm[] = [];

  for (const term of tagcloud) {
    if (KNOWN_SCRAPE_ARTIFACTS.has(term.term)) continue;

    const themeName = themeByKeyword.get(term.term);
    if (!themeName) {
      unclustered.push(toThemeTerm(term));
      continue;
    }

    const bucket = termsByTheme.get(themeName) ?? [];
    bucket.push(toThemeTerm(term));
    termsByTheme.set(themeName, bucket);
  }

  const themes = sortThemesByScore(
    [...termsByTheme.entries()].map(([name, terms]) => buildTheme(name, terms))
  );

  return { themes, unclustered };
}
