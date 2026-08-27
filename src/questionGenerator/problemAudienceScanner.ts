import path from "node:path";
import { extractedDir, geoDir, readJson } from "../scraper/datalake";
import type { GeoSignals, PhraseCloudEntry, StructuredSignals } from "../scraper/types";
import { containsExcludedTerm } from "./textFilters";
import type { AudienceSignal, ProblemClaim } from "./types";

const VERB_BASE_FORM: Record<string, string> = {
  reduces: "reduce",
  reduce: "reduce",
  removes: "remove",
  remove: "remove",
  eliminates: "eliminate",
  eliminate: "eliminate",
  simplifies: "simplify",
  simplify: "simplify",
  automates: "automate",
  automate: "automate",
  streamlines: "streamline",
  streamline: "streamline",
  improves: "improve",
  improve: "improve",
  restores: "restore",
  restore: "restore",
  enables: "enable",
  enable: "enable",
  gives: "give",
  give: "give",
};

const ORG_TYPE_KEYWORDS = [
  "startup", "startups", "enterprise", "enterprises", "large company",
  "large companies", "small business", "small businesses", "agency",
  "agencies", "small team", "small teams",
];

const USER_TYPE_KEYWORDS = [
  "engineering team", "engineering teams", "product team", "product teams",
  "marketing team", "marketing teams", "founder", "founders", "freelancer",
  "freelancers", "product manager", "product managers", "developer",
  "developers", "designer", "designers", "modern teams", "customer support",
  "support team", "support teams",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "helps teams plan..." / "lets you ship..." -- verb + optional filler
// subject, capturing the object clause as the problem. The filler is
// dropped (rather than left in the problem text) since it's redundant
// with the audience already captured separately via findAudienceSignals,
// and leaving it in produces a broken subject-first problem clause (e.g.
// "engineering teams plan, track..." reads wrong inside "trying to
// {problem}"). Includes the known audience phrases, longest first, so
// "engineering teams" is stripped as a unit rather than left dangling.
//
// Only "helps"/"lets" go here: their object is reliably a bare verb
// phrase ("helps teams plan/ship/track..."), so dropping the verb+filler
// still leaves a grammatical clause. "enables"/"gives" more often
// introduce a noun phrase ("enables unlimited issues, enhanced security
// controls...") -- dropping the verb there breaks the clause entirely
// ("trying to unlimited issues..."), discovered running this against
// real data. Those two keep their (normalized) verb -- see
// ENABLE_STYLE_PATTERN below.
const FILLER_TERMS = [
  "you", "your team", "teams?", "users?", "people",
  ...ORG_TYPE_KEYWORDS.map(escapeRegExp),
  ...USER_TYPE_KEYWORDS.map(escapeRegExp),
].sort((a, b) => b.length - a.length);

const HELP_STYLE_PATTERN = new RegExp(
  `\\b(?:helps?|lets?)\\s+(?:${FILLER_TERMS.join("|")})?\\s*([a-z][^.!?]{5,140})`,
  "gi"
);

const ENABLE_STYLE_PATTERN = new RegExp(
  `\\b(enables?|gives?)\\s+(?:${FILLER_TERMS.join("|")})?\\s*([a-z][^.!?]{5,140})`,
  "gi"
);

// "reduces noise...", "improves the speed...", "restores momentum..." --
// the verb itself is part of the claim and gets normalized to base form.
const DIRECT_VERB_PATTERN =
  /\b(reduces?|removes?|eliminates?|simplifies?|automates?|streamlines?|improves?|restores?)\s+([a-z][^.!?]{5,140})/gi;

const MIN_PROBLEM_WORDS = 3;
const MAX_PROBLEM_LENGTH = 140;

function trimFragment(fragment: string): string {
  return fragment.replace(/[,;:]\s*$/, "").trim();
}

// Longest match first so e.g. "product teams" (plural, matched) outranks
// "product team" (singular, also matches as a substring of the same
// text) -- otherwise pickAudiencePhrase() would grab the singular form
// even when the source said "teams", producing a subject-verb mismatch
// like "for product team that need to...".
function findAudienceSignals(text: string): AudienceSignal {
  const lower = text.toLowerCase();
  const byLengthDesc = (a: string, b: string) => b.length - a.length;
  return {
    orgTypes: ORG_TYPE_KEYWORDS.filter((term) => lower.includes(term)).sort(byLengthDesc),
    userTypes: USER_TYPE_KEYWORDS.filter((term) => lower.includes(term)).sort(byLengthDesc),
  };
}

function mergeAudience(a: AudienceSignal, b: AudienceSignal): AudienceSignal {
  return {
    orgTypes: [...new Set([...a.orgTypes, ...b.orgTypes])],
    userTypes: [...new Set([...a.userTypes, ...b.userTypes])],
  };
}

function isMeaningfulProblem(problem: string, exclude: Set<string>): boolean {
  if (problem.split(/\s+/).length < MIN_PROBLEM_WORDS) return false;
  if (containsExcludedTerm(problem, exclude)) return false;
  return true;
}

/**
 * Extracts candidate "problem" clauses from a piece of source text using
 * action-verb sentence patterns, plus whichever audience terms co-occur
 * anywhere in that same text. Heuristic (regex, not an LLM call) --
 * documented as approximate in SKILL.md, meant for human review.
 */
function extractProblemClaimsFromText(
  text: string,
  url: string,
  exclude: Set<string>
): ProblemClaim[] {
  const audience = findAudienceSignals(text);
  const claims: ProblemClaim[] = [];

  for (const match of text.matchAll(HELP_STYLE_PATTERN)) {
    const problem = trimFragment(match[1]).slice(0, MAX_PROBLEM_LENGTH);
    if (!isMeaningfulProblem(problem, exclude)) continue;
    claims.push({ problem, audience, evidence: [{ url, snippet: match[0].trim() }] });
  }

  for (const match of text.matchAll(ENABLE_STYLE_PATTERN)) {
    const verb = VERB_BASE_FORM[match[1].toLowerCase()] ?? match[1].toLowerCase();
    const object = trimFragment(match[2]).slice(0, MAX_PROBLEM_LENGTH);
    const problem = `${verb} ${object}`;
    if (!isMeaningfulProblem(problem, exclude)) continue;
    claims.push({ problem, audience, evidence: [{ url, snippet: match[0].trim() }] });
  }

  for (const match of text.matchAll(DIRECT_VERB_PATTERN)) {
    const verb = VERB_BASE_FORM[match[1].toLowerCase()] ?? match[1].toLowerCase();
    const object = trimFragment(match[2]).slice(0, MAX_PROBLEM_LENGTH);
    const problem = `${verb} ${object}`;
    if (!isMeaningfulProblem(problem, exclude)) continue;
    claims.push({ problem, audience, evidence: [{ url, snippet: match[0].trim() }] });
  }

  return claims;
}

export interface ScanProblemsOptions {
  excludeTerms?: string[];
}

/**
 * Scans a product's data lake for "problem the product claims to solve,
 * for whom" claims -- across meta descriptions, GEO definitions, and
 * phrase-cloud snippets -- and deduplicates by normalized problem text,
 * merging evidence and audience signals for repeated claims.
 */
export async function scanProblemAudienceClaims(
  product: string,
  options: ScanProblemsOptions = {}
): Promise<ProblemClaim[]> {
  const exclude = new Set((options.excludeTerms ?? []).map((t) => t.toLowerCase()));

  const [signals, geoSignals, phraseCloud] = await Promise.all([
    readJson<StructuredSignals[]>(path.join(extractedDir(product), "structured_signals.json")),
    readJson<GeoSignals[]>(path.join(geoDir(product), "geo_signals.json")),
    readJson<PhraseCloudEntry[]>(path.join(extractedDir(product), "phrase_cloud.json")),
  ]);

  if (!signals || !geoSignals || !phraseCloud) {
    throw new Error(
      `Missing scraper output for product "${product}" in datalake/${product}/. ` +
        `Run "npm run scrape -- --product ${product} --url <site>" first.`
    );
  }

  const rawClaims: ProblemClaim[] = [];

  for (const page of signals) {
    if (page.metaDescription) {
      rawClaims.push(...extractProblemClaimsFromText(page.metaDescription, page.url, exclude));
    }
  }
  for (const g of geoSignals) {
    if (g.entityClarity.definitionSnippet) {
      rawClaims.push(
        ...extractProblemClaimsFromText(g.entityClarity.definitionSnippet, g.url, exclude)
      );
    }
  }
  for (const entry of phraseCloud) {
    for (const occurrence of entry.occurrences) {
      rawClaims.push(...extractProblemClaimsFromText(occurrence.snippet, occurrence.url, exclude));
    }
  }

  const byProblem = new Map<string, ProblemClaim>();
  for (const claim of rawClaims) {
    const key = claim.problem.toLowerCase();
    const existing = byProblem.get(key);
    if (existing) {
      existing.evidence.push(...claim.evidence);
      existing.audience = mergeAudience(existing.audience, claim.audience);
    } else {
      byProblem.set(key, { ...claim, evidence: [...claim.evidence] });
    }
  }

  // A GEO definition often duplicates its page's meta description verbatim
  // (see extractGeoSignals's findDefinitionSnippet fallback), which
  // otherwise shows up as the same url+snippet listed twice as "evidence".
  for (const claim of byProblem.values()) {
    const seen = new Set<string>();
    claim.evidence = claim.evidence.filter((e) => {
      const key = `${e.url} ${e.snippet}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return [...byProblem.values()];
}
