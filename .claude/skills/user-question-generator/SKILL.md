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
site content for its distinctive positioning, then generates candidate
end-user questions grounded in it -- questions where the brand's own content
gives it the best shot at being the model's answer. Useful for content/GEO
strategy ("which real user questions is our content actually positioned to
win?"), not for fair competitive benchmarking.

It produces two derivatives with different strengths as a visibility signal
(see Part 1 / Part 2 in the output `.md` -- always read both parts' framing
before treating either as validated):

- **Part 1 -- hook-grounded** (`src/questionGenerator/templates.ts`): quotes
  or closely echoes the site's own phrasing back as a question. A model
  surfacing the brand here may just mean it recognized indexed text it read
  somewhere, not that it reasoned about fit -- a **floor** signal ("does the
  model even associate the brand with its own stated positioning?"), not
  proof of real-world strength.
- **Part 2 -- inferential** (`src/questionGenerator/problemAudienceScanner.ts` +
  `inferentialTemplates.ts`): extracts *what problem the product claims to
  solve, for whom* (org types like "startup"/"enterprise", user/role types
  like "engineering team"/"founder") as structured data, then phrases it as
  a generic user need -- never quoting the site. A model surfacing the brand
  here requires genuinely inferring fit from the paraphrased problem/
  audience description, which is the **stronger** signal of the two.

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
   (structured: `hooks`, `hookQuestions`, `claims`, `inferentialQuestions`)
   and `.md` (human-reviewable, split into Part 1/Part 2 with evidence
   links). Review before treating any of these as real AEO probes -- see
   limitations below.

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

## How problem/audience claims are scanned (`src/questionGenerator/problemAudienceScanner.ts`)

Runs two regex families over meta descriptions, GEO definitions, and
phrase-cloud snippets:

- **`helps X do Y` / `lets X do Y`** -- the verb and filler subject (a
  pronoun or a known audience phrase, e.g. "engineering teams") are
  stripped, since the object clause already reads as a bare action ("plan,
  track, and deliver work without a lot of overhead").
- **`enables X` / `gives X`** and **`reduces X` / `improves X` / `restores X`
  / etc.** -- here the verb is *kept* (normalized to base form) because the
  object is usually a noun phrase, not already a verb clause (e.g. "enable
  unlimited issues, enhanced security controls..."); stripping the verb for
  these produced broken fragments like "trying to unlimited issues..."
  during testing.

Audience terms (a curated keyword list of org types -- startup, enterprise,
small business... -- and user/role types -- engineering team, founder,
freelancer, product manager...) are detected anywhere in the same source
text as the problem clause. When two keywords both match the same text
(e.g. "product team" is a substring of "product teams"), the longer/plural
match wins -- picking the shorter one produced subject-verb disagreement
("for product team that need to..."). Claims are deduplicated by normalized
problem text across sources, with evidence and audience signals merged
(and evidence itself deduped by url+snippet, since a GEO definition often
duplicates its page's meta description verbatim).

## How inferential questions are built (`src/questionGenerator/inferentialTemplates.ts`)

Never quotes the site -- phrases the extracted problem (and detected
audience, if any) as a first-person or third-person generic need. Claims
with a detected audience get both the audience-free templates
(`persona-problem`, `generic-problem-only`) and the audience-specific ones
(`problem-for-audience`, `audience-fit-question`); claims with no detected
audience only get the audience-free set, so no question is ever generated
with an empty `{audience}` slot.

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
- **Problem extraction is regex-based, not real NLP.** It only catches
  problems phrased with one of a fixed list of trigger verbs
  (helps/lets/enables/gives/reduces/improves/...) -- a genuine
  differentiator phrased differently (e.g. "built for speed" with no
  action verb) won't be captured as a problem claim at all.
- **Audience vocabulary is a small curated keyword list**, not learned from
  the site -- an audience the site clearly targets but describes with
  wording not on the list (e.g. "solo builders") won't be detected.
