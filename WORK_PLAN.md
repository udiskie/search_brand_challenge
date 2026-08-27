# Work Plan — Brand Visibility Audit (SEO / GEO / AEO)

Source of truth for the requirements below: shared reference chat
https://claude.ai/share/5621bcbe-17a0-4dea-9744-52f92036377f

## Context

The technical test asks for an app that measures Linear's AEO (Answer Engine
Optimization) visibility against competitors (Jira, Asana, Monday, Notion) in
Gemini's answers, plus (per the follow-up design conversation in the reference
chat) a broader audit that also covers SEO and GEO signals scraped from each
product's own site. Deliverables are due before noon on Friday, Aug 28
(`caro@searchbrand.ai`): a deployed app, a public repo with real commit
history, `README.md`, `DECISIONS.md`, and — explicitly — any AI-agent
artifacts used to build it (CLAUDE.md, skills, subagents, hooks).

This document scopes the two pieces of work requested now:

1. A **web scraper** that populates the local data lake with SEO + GEO signals
   collected from each product's own site.
2. A **Claude Code skill** that turns the data lake (SEO + GEO + AEO layers)
   into the final SEO/GEO/AEO report with a prioritized action list.

Each is built on its own feature branch off `develop`, merged back
independently, with commit history that shows real iteration (per the
brief's explicit evaluation criterion — see "Evaluation criteria" below).

## Data lake layout (target contract both branches must honor)

```
/datalake/{product}/
  raw/
    sitemap.xml
    pages/{url_hash}.html
    pages/{url_hash}.meta.json
  extracted/
    pages_index.json
    tagcloud.json
    phrase_cloud.json
    structured_signals.json
  geo/
    geo_signals.json
  aeo/
    prompts_config.json
    runs/{run_id}.json
    aggregated_metrics.json
  report/
    report.json
    report.md
    priorities.json
```

`raw/`, `extracted/`, and `geo/` are produced by the scraper. `aeo/` and
`report/` are produced by the skill. This split lets the skill either reuse an
existing scrape or trigger one, without either branch depending on the other's
internals — only on this folder contract.

## Branch 1 — `feature/datalake-scraper`

**Goal:** crawl a product's own site and turn it into the SEO + GEO layers of
the data lake. No LLM calls in this branch.

Scope:

- **Sitemap fetch + crawl**: download `sitemap.xml` (including sitemap
  indexes), fetch each listed page, store raw HTML + response metadata
  (status, headers, timestamp) under `raw/pages/`. Respect `robots.txt` and
  rate-limit requests.
- **Quick vs Full mode**: Quick crawls a capped, prioritized subset of pages
  (e.g. home, pricing, top blog/docs by sitemap `priority`/type); Full crawls
  everything in the sitemap. This mirrors the brief's hint that scope
  (quick/full) is a design decision worth making explicit, not just a runtime
  flag.
- **SEO signal extraction** (`structured_signals.json`): title tag, meta
  description, heading hierarchy, schema.org markup, internal/external link
  counts, images missing `alt`, word count, keyword density; also sitemap
  coverage stats (orphan pages linked but not in the sitemap, 404s for URLs
  that are in it).
- **Tagcloud + phrase cloud** (`tagcloud.json`, `phrase_cloud.json`): tf-idf
  keyword extraction per page and aggregated site-wide, plus the sentences/
  snippets where each top keyword appears in context (visible text only,
  excluding nav/footer boilerplate).
- **Page index** (`pages_index.json`): URL, title, and a page-type
  classification (home/pricing/blog/docs/other) used later for report
  breakdowns.
- **GEO signal extraction** (`geo/geo_signals.json`): entity clarity
  (does the page state, in one self-contained sentence, what the product is),
  factual density vs. promotional language, E-E-A-T markers (visible
  authorship, publish/update dates, outbound citations), and extractable
  structure (lists/tables/definition blocks vs. long narrative paragraphs).
  This runs on the same crawled HTML, no external scan.
- **CLI entrypoint**, e.g. `npm run scrape -- --product linear --url
  https://linear.app --mode quick`.

Explicitly out of scope for this branch: external GEO signals that require
scanning third-party sources (Wikipedia, G2/Capterra, Reddit) — flagged in the
reference chat as a "probably needs an external scan" stretch item, not core.
Call this out as a documented exclusion in `DECISIONS.md`, not a silent gap.

Tests: fixture-based unit tests for each extractor (title/meta/schema
parsing, tf-idf ranking, GEO heuristics) against saved sample HTML, plus one
integration test running the CLI against a small mocked sitemap.

## Branch 2 — `feature/seo-geo-aeo-report-skill`

**Goal:** a Claude Code skill (`brand-visibility-audit`) that produces the
consolidated SEO/GEO/AEO report with a priority matrix. Depends on Branch 1's
folder contract (`raw/extracted/geo`) — reuses it if present, otherwise
invokes the scraper.

Per the skill-design principles pulled from the SNLabat SEO-GEO-AEO-Skill repo
during the reference conversation (adapted, not copied — that skill audits a
site directly; this one also audits an LLM's answers about a brand):

- `SKILL.md` is the source of truth: describes the procedure, the exact
  metric formulas, and what to ask the user (product/brand, site URL,
  competitors, engine(s) — default Gemini, Quick vs Full) — no business logic
  lives in it; that goes in the supporting scripts below.
- Supporting scripts (invoked by the skill, not embedded in it):
  - **Dynamic prompt generator** — builds `aeo/prompts_config.json` by
    combining dimensions: search intent (discovery / direct comparison /
    recommendation with constraint / troubleshooting-replacement / final
    decision), persona (role + team size), specificity (generic / names one
    brand / names 2+ brands), attribute anchor (price / speed-UX /
    integrations / methodology), language (es/en), plus a few
    adversarial/control prompts that never name the category directly (a
    stronger signal of organic visibility than direct-category prompts).
  - **Gemini REST client** — `POST
    generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`,
    key read from `GEMINI_API_KEY` (env only, never client-side). Runs each
    prompt N times (5–10) at temperature 0.8–1.0 to capture the model's
    non-determinism rather than average it away; separate calls per run
    rather than relying on `candidateCount`. Every raw response is written to
    `aeo/runs/{run_id}.json` with prompt id, dimensions, temperature,
    timestamp, and `finishReason` *before* any parsing — this is the
    auditable dataset. Includes throttling/retry for rate limits.
  - **AEO metrics calculator** — Share of Voice, SoV relative to the
    competitor average, average mention position, first-mention rate,
    sentiment score, attribute co-mentions, competitor co-occurrence matrix,
    and all of the above broken down by prompt dimension (e.g. intent type) —
    written to `aeo/aggregated_metrics.json`.
  - **Cross-validation step** — diffs the site's own `tagcloud.json`/
    `phrase_cloud.json` (Branch 1 output) against the vocabulary Gemini
    actually uses when mentioning the brand, surfacing GEO gaps (site says X,
    model never picks it up).
  - **Report generator** — consolidates SEO (`extracted/`), GEO (`geo/`), and
    AEO (`aeo/`) into `report/report.json` + human-readable `report.md`
    (executive summary/score per dimension → SEO → GEO → AEO → global
    priority matrix), and a structured `report/priorities.json` of
    `{dimension, finding, impact, effort, suggested_action}` items.

Tests: unit tests for each metric formula against fixed synthetic runs
(known SoV/position/sentiment inputs → expected outputs), and a
report-generation test using mocked Gemini responses (no live API calls in
CI).

## Branching workflow

- Both branches are cut from `develop`, per repo convention.
- Suggested merge order: `feature/datalake-scraper` first (the skill consumes
  its output contract), then `feature/seo-geo-aeo-report-skill`.
- Commit in small, real increments on each branch — the brief explicitly
  checks for iteration history, not a single squashed commit.
- Commit the skill's artifacts (`SKILL.md`, scripts, any CLAUDE.md updates)
  as part of the normal diff — the brief explicitly wants AI-agent tooling
  visible, not gitignored.

## Future work — not yet built

- ~~**Wire Part 1 and Part 2 questions into the AEO pipeline.**~~ **Done**
  (`feature/wire-questions-into-aeo`). `npm run aeo -- ... --include-questions
  hooks|inferential|both [--questions-runs N] [--questions-limit N]` runs
  Part 1/Part 2 candidate questions through Gemini as a third, explicitly
  brand-grounded prompt source, writing `aeo/brand_grounded_metrics.json`
  and a separate `## Brand-grounded question performance` report section —
  reusing the same tested SoV/position/sentiment/co-occurrence math
  (`src/aeo/aeoMetrics.ts`'s functions, widened and exported for reuse) but
  broken down by prompt source/awareness-stage instead of the neutral
  pipeline's dimensions, and never feeding into `scores`/`priorities`. Live
  smoke test found two real bugs before this was considered done: a naive
  concat-then-slice meant `--include-questions both` with a limit never
  actually reached a single inferential question (90 real hook questions
  exhausted any small limit first) — fixed to split the limit fairly and
  top up from whichever source has spare capacity; and a "1 runs" grammar
  slip in the new report section. Coarseness that remains: `--questions-limit`
  takes the first N per source, not a human-curated subset picked from
  `candidate_user_questions.md` — see `user-question-generator`'s SKILL.md.

- ~~**Genuine semantic clustering of extracted tags.**~~ **Taxonomy method
  done** (`feature/term-clustering-taxonomy`, see
  `.claude/skills/term-clustering/SKILL.md`), LLM method planned as a
  follow-on (`feature/term-clustering-llm`) for direct comparison. Today's
  `tagcloud.json` (`src/scraper/extractors/tagcloud.ts`) was a flat tf-idf
  ranking of individual word tokens with no grouping by meaning — confirmed
  against real output, where e.g. `team`/`teams` and `agent`/`agents` ranked
  as unrelated entries, and scrape artifacts (`contextreply`, `syncstatus`)
  interleaved with real content words purely because tf-idf has no concept
  of "is this even a real word." Built: `src/clustering/` buckets tagcloud
  terms into named themes via a hand-curated, category-level taxonomy
  (`src/clustering/taxonomy.ts`, same mechanism as
  `ORG_TYPE_KEYWORDS`/`USER_TYPE_KEYWORDS` in `problemAudienceScanner.ts`),
  then correlates each theme against candidate questions (Part 1/Part 2) and
  Gemini's raw answers (neutral + brand-grounded runs) — `npm run clusters
  -- --product linear --method taxonomy`, dashboard at
  `/products/{product}/clusters`. Visualized as a Treemap (theme size) +
  Sankey (theme → question coverage → answer-mention outcome) rather than a
  generic force-directed graph — evaluated and rejected the latter as too
  cluttered to answer the actual question, which is a flow/conversion one;
  see the skill's own write-up for the reasoning. The LLM method
  (`--method llm`) is the deliberate second half of this comparison — the
  first non-deterministic, paid-API step in a pipeline otherwise entirely
  deterministic by design — and writes to a sibling output file so both
  methods can be compared side by side via the dashboard's `?method=`
  toggle instead of one overwriting the other.

- ~~**UI work to display results to the user.**~~ **Done** (`feature/dashboard`),
  ahead of clustering above rather than after it: clustering is purely a
  display-organization concern on data that already existed, not a
  prerequisite, so this shipped the dashboard against the flat data first.
  Replaces the untouched `create-next-app` scaffold with: a home page
  listing every `datalake/` product (score badges for ones with a full AEO
  report, a "scraped, no report yet" state for scrape-only competitors), a
  per-product report page (executive summary, AEO Share-of-Voice table, the
  brand-grounded section when present, SEO/GEO panels, priority matrix), and
  a candidate-questions page (Part 1/Part 2, broken down by awareness
  stage). `src/lib/dashboardData.ts` reads directly off `datalake/` JSON via
  the scraper's existing path helpers/`readJson()` — no new storage layer,
  no API routes. If/when semantic clustering above gets built, this is the
  page that would consume it (grouping by theme instead of the current flat
  lists).

## Open decisions to carry into `DECISIONS.md`

- Whether raw crawled HTML (`raw/pages/*.html`) is committed to the repo or
  gitignored with only `extracted/`, `geo/`, `aeo/`, and `report/` committed
  as evidence — raw HTML can get large fast; recommend gitignoring raw pages
  and keeping everything else.
- External GEO signals (third-party citability sources) are out of scope for
  the initial pass given the Friday deadline — documented exclusion, not a
  silent gap.
- How the already-scaffolded Next.js app (this repo) consumes these two
  branches' output (e.g. reading `report/report.json` to render a dashboard)
  is a separate, later work item — not covered by this plan.
