---
name: user-question-generator
description: Scans a product's scraped data lake (SEO/GEO signals) to generate realistic, brand-grounded candidate questions -- the kind a real user might ask an AI assistant that would plausibly surface the brand by name. Use when the user asks to "generate user questions for <brand>", "find prompts that would mention <brand>", or wants candidate AEO probes grounded in a brand's own site content rather than neutral category prompts.
---

# User Question Generator

**Status: early development, first increment.** This skill currently produces
a scanner + template pipeline and a reviewable candidate-question artifact
per product. It does not yet feed candidate questions into the AEO
measurement pipeline (`src/aeo/`) automatically -- that's a natural next
step, not yet built.

## Purpose and how it differs from the AEO skill's prompt generator

`src/aeo/promptGenerator.ts` (used by the `brand-visibility-audit` skill)
generates *neutral, balanced* prompts across a category to fairly benchmark
Share of Voice against named competitors -- it deliberately avoids leaning on
any one brand's own vocabulary.

This skill does the opposite on purpose: it scans a product's own scraped
site content for its distinctive positioning language, then generates
candidate end-user questions grounded in that language -- questions where
the brand's own content gives it the best shot at being the model's answer.
Useful for content/GEO strategy ("which real user questions is our content
actually positioned to win?"), not for fair competitive benchmarking.

## Workflow

1. Requires the product to already have scraper output in `datalake/{product}/`
   (see the `datalake-scraper` work / `WORK_PLAN.md`). If missing, run
   `npm run scrape -- --product <name> --url <site>` first.
2. Run:
   ```bash
   npm run questions -- --product <name> --brand <Brand>
   ```
   `--brand` is used to exclude any hook that merely mentions the brand
   inline (substring match, not just exact match -- a meta description
   like "Use Linear for free..." must be excluded even though it isn't
   equal to "Linear") -- otherwise the resulting question would trivially
   name-drop the brand instead of testing for an organic mention.
3. Output lands in `datalake/{product}/questions/candidate_user_questions.json`
   (structured: hooks + questions) and `.md` (human-reviewable, grouped by
   hook with evidence links). Review before treating any of these as real
   AEO probes -- see limitations below.

## How hooks are scanned (`src/questionGenerator/datalakeScanner.ts`)

- **Meta descriptions** (`structured_signals.json`) -- the site's own
  curated one-sentence pitch per page.
- **GEO self-contained definitions** (`geo_signals.json`'s
  `entityClarity.definitionSnippet`).
- **Recurring tagcloud terms** (`tagcloud.json`, cross-referenced with
  `phrase_cloud.json` for in-context evidence) -- filtered to
  document-frequency ≥2 and length ≥4 chars, with a small denylist of
  known scrape artifacts (minified JS/JSON leaking into extracted text,
  e.g. `contextreply`, `syncstatus` -- observed scanning linear.app).

## How questions are built (`src/questionGenerator/templates.ts`)

Hooks come in two shapes and need different templates -- discovered by
running this against Linear's real data lake: splicing a full-sentence hook
(a meta description) into a template built for a short phrase produces
broken English (e.g. "I need something that helps with Purpose-built for
planning... -- what should my team use?"). So:

- **Short-phrase hooks** (tagcloud terms, ≤6 words) use
  `SHORT_PHRASE_TEMPLATES`: direct-differentiator, problem-framed,
  comparison-anchor, persona-specific.
- **Long-form hooks** (sentence-length meta descriptions/definitions) use
  `LONG_FORM_TEMPLATES`, which quote the sentence directly rather than
  splicing it in.

## Known limitations (disclose these when presenting output)

- **Frequency ≠ distinctiveness.** A tagcloud term passing the
  document-frequency filter (e.g. "product", "work") is merely *repeated*
  on the brand's own site, not necessarily *distinctive* to it -- a
  competitor's site would use the same generic words. Catching genuine
  distinctiveness would need tf-idf across a corpus that includes
  competitors (comparing against `datalake/{competitor}/extracted/tagcloud.json`),
  which isn't built yet.
- **Not yet wired into AEO measurement.** These candidate questions aren't
  automatically run through `src/aeo/geminiClient.ts` -- a human should
  review the `.md` output and hand-pick which ones are worth adding to a
  real AEO probe set.
- **Single-page-derived hooks** (meta description, GEO definition) have
  `documentFrequency: 1` by construction, even if the same idea appears
  reworded across several pages -- no cross-page semantic dedup yet.
