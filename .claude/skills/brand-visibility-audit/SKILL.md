---
name: brand-visibility-audit
description: Audits a brand's visibility across SEO (own-site signals), GEO (how citable the site is for an LLM), and AEO (how often/how well an LLM like Gemini mentions the brand vs. named competitors when asked category-relevant questions). Use when the user asks to "audit brand visibility", "run an AEO/GEO/SEO audit", "measure how <brand> shows up in Gemini vs <competitors>", or references this project's WORK_PLAN.md audit.
---

# Brand Visibility Audit (SEO / GEO / AEO)

Produces a single consolidated report scoring a brand on three axes and ranking
fixes by impact × effort. This file describes *what* to do and *why* — it
contains no business logic. All logic lives in `src/scraper/` (SEO/GEO data
collection) and `src/aeo/` (AEO measurement + report generation), both
invoked as plain CLI commands from here.

## When to use this skill

- "Audit \<brand>'s SEO/GEO/AEO visibility against \<competitors>"
- "How does Gemini talk about \<brand> vs \<competitors>?"
- "Regenerate the report for \<product>"
- Any request referencing this repo's `WORK_PLAN.md` brand-visibility audit

## Inputs to elicit before running anything

Ask for whatever the user hasn't already given you:

1. **Product/brand name** and its **site URL** (used as the data lake key,
   e.g. `linear` / `https://linear.app`).
2. **Category** the brand competes in (e.g. "project management tool") — this
   feeds the AEO prompt templates.
3. **Competitors** — a short list of named brands to benchmark against.
4. **Engine(s)** — default is Gemini; this skill currently only implements
   Gemini's REST API.
5. **Quick or Full?** Always ask explicitly, don't assume:
   - **Quick** (default): ~10 crawled pages, 10 AEO prompts × 3 runs each.
     Fast, good for a sanity check or iterating on the report format.
   - **Full**: full sitemap crawl, 24 AEO prompts × 6 runs each. Slower and
     uses more of the Gemini quota — confirm the user wants this before
     kicking it off, since it can take several minutes and many API calls.

## Workflow

### Step 1 — Data lake check

Check whether `datalake/{product}/extracted/` and `datalake/{product}/geo/`
already exist and look populated (this repo has committed quick-mode data for
`linear`, `jira`, `asana`, `monday`, `notion`). If not, either run the scraper
first or let step 2 auto-trigger it via `--url`.

```bash
npm run scrape -- --product <product> --url <site> --mode quick|full
```

### Step 2 — AEO probe + report generation

Make sure `.env.local` exists with `GEMINI_API_KEY` set (copy `.env.example`
if not — the CLI loads it automatically, never ask the user to paste the key
into chat).

```bash
npm run aeo -- \
  --product <product> --brand <Brand> --competitors <A,B,C> \
  --category "<category>" [--url <site>] --mode quick|full
```

`--url` is only needed if step 1 wasn't run yet — `npm run aeo` will scrape
first automatically when the data lake is empty for that product. This single
command generates the AEO prompt set, calls Gemini `runsPerPrompt` times per
prompt, extracts brand mentions, computes AEO metrics, cross-validates
against the site's own tagcloud, and writes the final report — see
`WORK_PLAN.md` for the full `datalake/{product}/...` folder layout.

### Step 2b — Optional: also probe brand-grounded questions

If the `user-question-generator` skill has already been run for this product
(`datalake/{product}/questions/candidate_user_questions.json` exists), you can
additionally run its Part 1 (hook-grounded) and/or Part 2 (inferential)
candidate questions through Gemini as a **third, explicitly non-neutral**
prompt source — this is opt-in, never automatic, and never touches the
neutral SEO/GEO/AEO scores:

```bash
npm run aeo -- \
  --product <product> --brand <Brand> --competitors <A,B,C> --category "<category>" \
  --include-questions hooks|inferential|both [--questions-runs 2] [--questions-limit N]
```

`--questions-limit` matters in practice — a product can easily have 100+
candidate questions between both derivatives; ask the user before running
without a limit. Results land in a separate `## Brand-grounded question
performance` report section and `aeo/brand_grounded_metrics.json` — see
"Brand-grounded vs. neutral" below for why these numbers should never be
compared directly to the main AEO table.

### Step 3 — Hand back the report

Read `datalake/{product}/report/report.md` and summarize it for the user
(executive summary scores, top 3-5 priority items). Point them at
`report.json`/`priorities.json` if they want the structured data.

## Metric formulas (for auditability)

These are implemented in `src/aeo/aeoMetrics.ts` and `src/aeo/reportGenerator.ts`.
Reproduced here so the numbers in a report can be checked without reading code.

**AEO, per brand, over all Gemini runs for this audit:**

- **Share of Voice (SoV)** = (# runs where the brand is mentioned at all) / (total runs)
- **Relative SoV** = brand SoV / (average SoV of the *other* tracked brands).
  If no competitor is ever mentioned, the average is floored at `1/totalRuns`
  instead of 0, so this doesn't divide by zero.
- **Average position** = mean of the brand's 1-indexed mention order (by
  first occurrence in the response text) across the runs it appears in.
  `null` if the brand is never mentioned.
- **First-mention rate** = (# runs where the brand is the *first* brand
  mentioned) / (total runs).
- **Sentiment score** = mean of the brand's per-mention sentiment, scored
  positive=+1 / neutral=0 / negative=-1.
- **Co-occurrence** = for each brand, how often each other tracked brand
  appears in the same run.
- **By-dimension breakdown** = the same SoV formula recomputed within each
  value of each prompt dimension (intent, persona, specificity, attribute,
  language), so visibility can be cut by "type of question asked."

**SEO score (0-100, per page then averaged):** average of four sub-scores —
H1 present exactly once (100/0), meta description present and ≥50 chars
(100/50/0), any schema.org markup present (100/0), and % of images with alt
text — minus a penalty of `min(30, 5 × broken sitemap URLs)`.

**GEO score (0-100, per page then averaged):** average of four sub-scores —
self-contained brand definition present (100/0), factual-density score ×100,
E-E-A-T score (author/publish-date/update-date each worth up to ~33), and
extractable-structure score ×100 (lists/tables/definition blocks present).

**AEO score (0-100):** `60% × (brand SoV × 100) + 40% × (normalized sentiment)`,
where normalized sentiment maps the -1..1 sentiment score to 0..100.

**Priority matrix:** every finding across the three dimensions is tagged
`{dimension, finding, impact, effort, suggestedAction}` and sorted
impact-first (high → low), then effort-first (low → high) as a tiebreak —
see the rule list in `reportGenerator.ts`'s `seoFindings`/`geoFindings`/
`aeoFindings` functions for exactly which conditions produce which findings.

**Brand-grounded metrics (`report.brandGrounded`, when Step 2b was run):**
same SoV/relative-SoV/position/first-mention/sentiment/co-occurrence
formulas as above (literally the same functions, `src/aeo/aeoMetrics.ts`'s
`shareOfVoice`/`computeBrandMetrics`/`computeCoOccurrence`, reused directly —
see `src/aeo/brandGroundedMetrics.ts`), but computed only over the Part 1/2
runs, broken down by prompt `source` (hook vs. inferential) and, for
inferential runs, `stage` (pain_only/problem_framed/comparing_with_criteria)
instead of the neutral pipeline's intent/persona/specificity/attribute/
language dimensions. Never feeds into `scores` or `priorities`.

## Brand-grounded vs. neutral — never compare these directly

The main AEO table asks *neutral* prompts (`src/aeo/promptGenerator.ts`
deliberately avoids any brand's own vocabulary) to fairly benchmark Share of
Voice across named competitors. `report.brandGrounded` (Step 2b) instead runs
questions *deliberately grounded* in the audited brand's own site content —
its SoV there answers a different question ("how does the brand do on its
own best-case questions?"), not "how visible is it in fair category
comparison?" A high brand-grounded SoV next to a low neutral SoV is not a
contradiction to flag as an error; it's the expected shape when a brand's
content strongly echoes its own positioning but doesn't win organically on
neutral category questions. Always present these as two separate findings,
never averaged or blended into one number — this is exactly the persona-
inference neutrality tension documented in `DECISIONS.md`, generalized to
prompt sourcing.

## Known limitations (be upfront about these when presenting a report)

- **Mention extraction is heuristic, not a second LLM call.** Brand mentions,
  sentiment, and role (recommended/compared/discarded) are found via
  keyword/regex matching over a small context window (see
  `src/aeo/mentionExtractor.ts`), not a second Gemini call to structure the
  first response. This is faster and free but will miss indirect phrasing
  (e.g. sarcasm, or a brand referred to only by a pronoun).
- **A product without its own marketing domain** (e.g. Jira, under
  atlassian.com) gets scraped at its shared corporate domain, so its
  SEO/GEO signals reflect that broader site, not a Jira-specific one.
- **Quick mode's page selection** is a heuristic (home/pricing/docs/blog
  first, then highest sitemap `priority`, non-English locale paths
  deprioritized) — it can still miss a page that matters for a specific
  audit; use Full mode if page coverage looks thin in the report.

## Hard rules

- Never hardcode, log, or ask the user to paste the Gemini API key in chat;
  it's read from `GEMINI_API_KEY` via `.env.local` only (see `src/aeo/cli.ts`).
- Always save every raw Gemini response (`datalake/{product}/aeo/runs/*.json`,
  or `aeo/brand_grounded_runs/*.json` for Step 2b) before any parsing — this
  is the auditable dataset. Never regenerate a report by re-querying Gemini
  for data that's already saved.
- Don't run Full mode without telling the user it can take several minutes
  and many API calls first.
