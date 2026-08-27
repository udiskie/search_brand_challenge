import { callGemini, type GeminiClientConfig } from "../aeo/geminiClient";
import { KNOWN_SCRAPE_ARTIFACTS } from "../questionGenerator/datalakeScanner";
import type { TagcloudTerm } from "../scraper/types";
import { buildTheme, sortThemesByScore, toThemeTerm } from "./themeUtils";
import type { Theme, ThemeTerm } from "./types";

const TOP_N_TERMS = 50;

interface LlmClusteringResponse {
  themes: { name: string; terms: string[] }[];
  unclustered: string[];
}

function buildPrompt(terms: string[]): string {
  return (
    `You are categorizing website vocabulary for a "project management / ` +
    `productivity SaaS" product into semantic themes.\n\n` +
    `Group the following terms into named semantic themes (short, clear ` +
    `names, 2-4 words, e.g. "AI & Automation", "Pricing & Plans"). Every ` +
    `term must appear in exactly one theme's "terms" array, or in ` +
    `"unclustered" if it genuinely fits no theme. Do NOT invent new terms ` +
    `-- only use terms from this exact list, and do not omit any term.\n\n` +
    `Terms: ${terms.join(", ")}\n\n` +
    `Respond with ONLY valid JSON in this exact shape, no markdown ` +
    `fences, no commentary:\n` +
    `{"themes":[{"name":"Theme Name","terms":["term1","term2"]}],"unclustered":["term3"]}`
  );
}

/** Strips a ```json ... ``` (or bare ```) fence Gemini sometimes wraps JSON in. */
function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function isLlmClusteringResponse(value: unknown): value is LlmClusteringResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.themes) || !Array.isArray(v.unclustered)) return false;
  return v.themes.every(
    (t) =>
      typeof t === "object" &&
      t !== null &&
      typeof (t as { name?: unknown }).name === "string" &&
      Array.isArray((t as { terms?: unknown }).terms)
  );
}

/**
 * Clusters tagcloud terms into named themes via a single, low-temperature
 * Gemini call -- the deliberate second half of comparing against the
 * hand-curated taxonomy method (clusterTermsByTaxonomy). This is the
 * first non-deterministic, paid-API step in a pipeline otherwise entirely
 * deterministic by design outside the AEO measurement itself (see
 * DECISIONS.md and term-clustering's SKILL.md).
 *
 * Parses defensively: only terms Gemini actually names (and that exist in
 * the original input) are kept -- an invented term is dropped rather than
 * fabricated into the output, and any real term Gemini's response omits
 * falls back to `unclustered` rather than silently vanishing.
 */
export async function clusterTermsByLlm(
  tagcloud: TagcloudTerm[],
  geminiConfig: Pick<GeminiClientConfig, "apiKey" | "model" | "timeoutMs" | "maxRetries">,
  fetchImpl: typeof fetch = fetch
): Promise<{ themes: Theme[]; unclustered: ThemeTerm[] }> {
  const candidates = tagcloud
    .filter((t) => !KNOWN_SCRAPE_ARTIFACTS.has(t.term))
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N_TERMS);

  const byTerm = new Map(candidates.map((t) => [t.term, t]));
  const allTerms = [...byTerm.keys()];

  const fallbackUnclustered = candidates.map(toThemeTerm);
  if (allTerms.length === 0) return { themes: [], unclustered: [] };

  const { text } = await callGemini(
    buildPrompt(allTerms),
    { ...geminiConfig, temperature: 0.2 },
    fetchImpl
  );

  if (!text) return { themes: [], unclustered: fallbackUnclustered };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    return { themes: [], unclustered: fallbackUnclustered };
  }

  if (!isLlmClusteringResponse(parsed)) {
    return { themes: [], unclustered: fallbackUnclustered };
  }

  const claimed = new Set<string>();
  const themes: Theme[] = [];

  for (const themeResponse of parsed.themes) {
    const terms: ThemeTerm[] = [];
    for (const termName of themeResponse.terms) {
      const original = byTerm.get(termName);
      // Skip terms Gemini invented (not in the input) or already claimed
      // by an earlier theme in its own response.
      if (!original || claimed.has(termName)) continue;
      claimed.add(termName);
      terms.push(toThemeTerm(original));
    }
    if (terms.length > 0) themes.push(buildTheme(themeResponse.name, terms));
  }

  const unclustered = allTerms
    .filter((term) => !claimed.has(term))
    .map((term) => toThemeTerm(byTerm.get(term)!));

  return { themes: sortThemesByScore(themes), unclustered };
}
