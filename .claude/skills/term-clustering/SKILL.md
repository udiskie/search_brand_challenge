---
name: term-clustering
description: Groups a product's flat tagcloud terms into named semantic themes, then correlates each theme against candidate questions (user-question-generator) and Gemini's raw answers (brand-visibility-audit's AEO runs). Use when the user asks to "cluster terms/tags", "group the tagcloud by theme", or wants to see which topics generated questions cover vs. which actually surface in Gemini's answers.
---

# Term Clustering

**Status:** both methods are built and run against real data for all 5
products -- `--method taxonomy` (hand-curated) and `--method llm` (one
Gemini call per product), swappable via the dashboard's `?method=` toggle.
See "Comparing the two methods" below for what running both against the
same real data actually showed.

## Purpose

`src/scraper/extractors/tagcloud.ts`'s `tagcloud.json` is a flat tf-idf
ranking of individual word tokens with no grouping by meaning: `team`/`teams`
and `agent`/`agents` rank as unrelated entries, and scrape artifacts
(`contextreply`, `syncstatus`) interleave with real content words purely
because tf-idf has no concept of "is this even a real word." This skill
buckets those terms into named themes (e.g. "AI & Automation", "Pricing &
Plans"), then answers two follow-up questions per theme:

- **Coverage**: how many candidate questions (Part 1 hook-grounded + Part 2
  inferential, from `user-question-generator`) touch this theme's
  vocabulary?
- **Surfacing**: how many of Gemini's actual raw answers (neutral AEO runs +
  brand-grounded runs) mention this theme's vocabulary at all?

A theme with real question coverage that never shows up in answers is a
theme-level GEO gap -- the clustering equivalent of the per-term gap
`src/aeo/crossValidate.ts` already surfaces, but grouped into something a
human can actually scan instead of 100+ individual terms.

## Workflow

```
npm run scrape -- --product linear --url https://linear.app   # if not already run
npm run clusters -- --product linear --method taxonomy
```

Reads `extracted/tagcloud.json` (required), `questions/
candidate_user_questions.json` and `aeo/runs/` + `aeo/brand_grounded_runs/`
(all optional -- a product that hasn't run `npm run questions` or `npm run
aeo` yet still gets a valid, partially-empty clustering rather than an
error). Writes `datalake/{product}/clusters/theme_clusters.{method}.json`.

Dashboard: `/products/{product}/clusters` (linked from the product report
page whenever a tagcloud exists), with `?method=taxonomy` / `?method=llm` to
switch. Requesting a method that hasn't been run yet falls back to whichever
method *has* run, with a visible note rather than a 404.

## Method (b): hand-curated taxonomy (`src/clustering/taxonomy.ts`)

One shared, category-level keyword map ("project management / productivity
SaaS", the category all 5 audited products share) -- same mechanism as
`ORG_TYPE_KEYWORDS`/`USER_TYPE_KEYWORDS` in
`questionGenerator/problemAudienceScanner.ts`: cheap, deterministic,
consistent with the rest of the pipeline's design (regex/tf-idf/keyword lists
throughout, no LLM calls outside the AEO measurement itself), but not truly
semantic and needs re-authoring for a different product category.

Nine themes: AI & Automation, Collaboration & Teams, Issue & Project
Tracking, Integrations & Ecosystem, Speed & Focus, Pricing & Plans, Security
& Compliance, Docs & Knowledge, Design & UX. Each keyword is a single token
(tagcloud terms are already single words from `tokenize()`), and keyword
lists are unique across themes so assignment doesn't depend on iteration
order. A term matching no theme, or in the existing `KNOWN_SCRAPE_ARTIFACTS`
set (`questionGenerator/datalakeScanner.ts`, now exported for reuse here),
lands in an explicit `unclustered` bucket rather than being force-fit --
confirmed against real data: roughly 30-45 of each product's top-50 terms end
up unclustered (proper nouns, verbs, generic SaaS words like "customer" /
"business" the taxonomy doesn't cover). That's an honest limitation, not a
bug -- expanding the taxonomy's coverage is a matter of adding more keywords,
not fixing broken logic.

## Method (a): LLM-based (`src/clustering/clusterTermsByLlm.ts`)

One low-temperature (0.2) Gemini call per product (`callGemini`, reused from
`src/aeo/geminiClient.ts`), given the top 50 tagcloud terms by score (same
`KNOWN_SCRAPE_ARTIFACTS` exclusion applied first, so both methods start from
the same candidate set) and asked to invent its own theme names and bucket
the terms into them, returned as strict JSON. Parsed defensively: any term
the model names that wasn't actually in the input is dropped rather than
fabricated into a theme; the whole response falls back to fully-unclustered
if it isn't valid JSON in the expected shape or if Gemini returns no text at
all (rate limit, safety block, timeout). This is the first non-deterministic,
paid-API step in the pipeline outside AEO measurement itself -- see
DECISIONS.md's "Term clustering: an LLM call, deliberately, for one specific
step" for why that tradeoff was made on purpose here and nowhere else.

## Correlation (`src/clustering/correlate.ts`, shared by both methods)

- `correlateQuestions`: tokenizes each candidate question's text and attaches
  it to every theme whose terms intersect.
- `correlateAnswers`: tokenizes each run's raw Gemini response text and
  tallies how many mention the theme's vocabulary at all (not tied to
  whether the audited brand specifically was mentioned -- this is about the
  *topic* showing up, independent of brand), keeping up to 3 context-window
  snippets as evidence. Called once for neutral AEO runs, once for
  brand-grounded runs, since brand-visibility-audit deliberately keeps those
  two prompt sources separate (see its own SKILL.md / DECISIONS.md).

## Visualization: why a Sankey, not a generic node-link graph

Evaluated a force-directed graph (themes + 100+ question nodes + brand
nodes) and rejected it: with this many nodes it gets visually cluttered fast
and doesn't actually answer the question a user has here, which is a
flow/conversion one. Instead:

- **Treemap** (`src/components/dashboard/ThemeTreemap.tsx`) -- relative theme
  size (combined term tf-idf score), the simple "how much of the site's
  vocabulary does each theme cover" view.
- **Sankey** (`src/components/dashboard/ThemeSankey.tsx`) -- Theme → question
  coverage (has/doesn't have candidate questions) → answer outcome
  (mentioned/never mentioned). Still graph-like (nodes + weighted links),
  but a flow diagram directly encodes the actual insight: which themes
  convert from "we asked about it" into "the model actually talks about it,"
  vs. which don't. Both components use `recharts` (already a dependency via
  the shadcn `chart` component) -- no new dependency for either chart.

## Known limitations (disclose these when presenting output)

- **Single-token terms only.** Neither method clusters multi-word phrases --
  clustering operates on `tagcloud.json`'s already-tokenized single words,
  same granularity limit as the tagcloud itself.
- **Category-level, not per-product.** The taxonomy is authored once for
  "project management / productivity SaaS" and shared by all 5 products
  (Linear/Jira/Asana/Monday/Notion are all this category) -- it would need
  re-authoring, not just re-running, for a product in a different category.
- **Small sample sizes.** Answer-mention correlation is only as reliable as
  the underlying AEO run counts (30 neutral / up to 8 brand-grounded runs per
  product in this project's committed evidence) -- a theme showing 0/30
  mentions from a small sample is suggestive, not conclusive.
- **Topic mention, not brand attribution.** `correlateAnswers` checks whether
  a theme's vocabulary appears anywhere in an answer, regardless of which
  brand (if any) that answer was actually praising -- it is not a
  brand-specific signal the way `aeoMetrics.ts`'s Share of Voice is.

## Comparing the two methods

Both methods write to separate files (`theme_clusters.taxonomy.json` /
`theme_clusters.llm.json`) so they can be committed and compared side by
side rather than one overwriting the other -- switch between them on
`/products/{product}/clusters` via `?method=`; the page shows a compact
theme-count / unclustered-count comparison note whenever both exist for a
product.

Run against Linear's real committed evidence, the difference was real and
sizable, not marginal: the taxonomy left 33 of the top-50 terms unclustered
(a fixed 9-theme keyword list, however carefully authored, can't anticipate
every real word) vs. only 7 for the LLM method, which also invented its own
theme names on the fly ("Project & Issue Tracking," "Development & Code,"
"Time & Scheduling") rather than picking from a preset list -- a closer fit
to the actual vocabulary, at the cost of non-determinism (re-running
`--method llm` isn't guaranteed to reproduce identical theme names) and a
real Gemini API call per product. Neither method is "more correct"; they
trade determinism/cost for coverage/fit in opposite directions, which is
the whole point of building both instead of picking one on paper.
