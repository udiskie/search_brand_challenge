# Decisions

What was decided, what was assumed, and what was deliberately left out of
scope for this exercise — and why.

## Scope: profiling which user prompts get an LLM to mention Linear

**Decision:** this exercise is scoped around one core question — what would
a real user type into an LLM (Gemini, the only engine implemented) such
that the model's answer plausibly mentions Linear by name? Every pipeline
component — the site scraper feeding SEO/GEO signals, the neutral AEO
prompt set (`src/aeo/promptGenerator.ts`), the brand-grounded question
generator (`src/questionGenerator/`), and the resulting Share-of-
Voice/position/sentiment metrics — exists to profile that single question
from different angles, not to build a general-purpose prompt-engineering,
SEO, or content-marketing tool in its own right.

**Why:** the brief asks how visible Linear is when a category-relevant
question is put to an AI engine, relative to named competitors. Treating
"what prompt would make Gemini say Linear" as the organizing question keeps
every other piece of the pipeline in service of one measurable outcome —
Gemini's *response* is the object being studied, with the site's own
SEO/GEO signals treated as inputs that plausibly explain why a prompt does
or doesn't surface the brand, not as an end in themselves.

**What was left out:** other engines (ChatGPT, Perplexity, Claude, AI
Overviews, etc.) are explicitly out of scope — only Gemini's REST API is
implemented (see `brand-visibility-audit`'s `SKILL.md`). Multi-turn
conversations are also out of scope; every probe is a single-turn prompt,
so this project says nothing about whether Linear holds up (or fades) as a
conversation continues.


## Data lake scraper: quick-mode sampling, not exhaustive crawling

**Decision:** The scraper defaults to "quick mode" — a small, prioritized
sample of ~10-15 pages per product (home, up to 2 pricing pages, up to 2
docs pages, up to 2 blog pages, then whatever's left filled in by the
sitemap's own `priority` field) — rather than crawling a site's entire
sitemap. All committed data lake evidence (Linear, Jira, Asana, Monday,
Notion) was generated this way, with `--quick-cap 10`.

**Why:** Real sitemap sizes for these competitors are far larger than what
an AEO/SEO/GEO audit needs to be representative — e.g. atlassian.com's (Jira's)
sitemap lists 28,048 URLs, notion.com's lists 15,801, asana.com's lists
3,415, against only 10 pages actually crawled for each. The pages that
shape a brand's positioning for this kind of audit (home, pricing, docs,
blog) are a small, identifiable subset; crawling everything would mean far
more time/bandwidth spent on pages irrelevant to the audit (individual blog
post archives, per-locale duplicates, unrelated product sub-pages on a
shared corporate domain, etc.).

**What was left out:** `--mode full` exists in the code (`src/scraper/cli.ts`,
`src/scraper/run.ts`) and is covered by unit tests against small synthetic
fixtures, but it was never run against any of the five real competitor
sites in this project. Exhaustively crawling a site's full sitemap (tens of
thousands of pages for some of these competitors) was purposely left out of
scope for this exercise.

## No dedicated data lake environment

**Decision:** The "data lake" is a plain directory (`datalake/`) of JSON and
raw HTML files, committed directly to this git repo — not a dedicated
storage/versioning system (object storage like S3/R2, a data warehouse, or
a git-for-data tool like LakeFS).

**Why:** The data volume for this exercise is small (five products, ~10
pages each), so a real data-lake platform would add operational overhead
(infrastructure to stand up, credentials to manage) without a matching
benefit. Git already provides the versioning/audit trail this project needs
(the brief explicitly asks for real commit history), so adding a second
versioning system on top would just duplicate it. This mirrors the earlier
call to skip LakeFS specifically for the same reason (see the reference
planning chat linked from `WORK_PLAN.md`).

**What was left out:** Independent scaling of storage from the app/repo, a
query engine over the data (every reader loads JSON files directly off
disk), and any access-control layer separate from repo permissions.
Practically, this also means the repo's size grows with every scrape run
(raw HTML committed alongside code), which wouldn't be sustainable at a
larger scale or over a longer time horizon than this exercise.

## No scheduled job to re-run the scraping

**Decision:** There is no recurring/automated job (cron, GitHub Actions
workflow, etc.) that periodically re-runs the scraper, the AEO probe, or
the question generator to keep the data lake fresh. Every run in this
project was triggered manually via the CLIs (`npm run scrape`, `npm run
aeo`, `npm run questions`).

**Why:** Given the timeline for this exercise, the priority was proving the
pipeline works correctly end-to-end against real sites and the real Gemini
API first. Automating a recurring pipeline would additionally require
secrets management for the Gemini API key in a scheduled context,
rate-limit-aware scheduling, and failure monitoring/alerting — all real
work that wasn't warranted before the pipeline itself was validated.

**What was left out:** Any form of scheduled re-scraping or re-auditing.
Practically, this means the committed data lake is a snapshot as of when it
was generated in this session — competitor sites' content, pricing, and
positioning will drift over time, and the committed AEO/report data will
grow stale, unless someone manually re-runs the CLI commands.

## Skipped: inferring AEO personas from scraped content (neutrality tension)

**Decision:** `brand-visibility-audit`'s prompt generator
(`src/aeo/promptGenerator.ts`) keeps its hardcoded, generic `PERSONAS` list
(startup founder, engineering lead, product manager, freelancer, marketing
team) rather than inferring personas from scraped site content. This was
requested and then explicitly deprioritized rather than built.

**Why left out:** This skill's entire value proposition, documented in its
own `SKILL.md`, is generating *neutral, balanced* prompts to fairly
benchmark the audited brand's Share of Voice against named competitors —
it "deliberately avoids leaning on any one brand's own vocabulary." If
personas were inferred from the audited brand's own scraped content (the
obvious, simplest way to do it, and the same approach
`user-question-generator` already uses for its brand-grounded questions),
the persona set would skew toward whichever audience that one brand's
marketing targets, biasing the "neutral" comparison in the audited brand's
favor before a single Gemini call is even made. The technically correct
fix — aggregating detected audience signals across the audited brand *and*
every named competitor's scraped content, so no single company's framing
dominates the persona pool — is a real option, but wasn't specced or built
here; it needs its own design pass (e.g. does it require all competitors to
already be scraped before an AEO run? what if their datalake output is
missing?) rather than being bolted on quickly.

**What was left out:** Any persona inference in `src/aeo/`. Contrast with
`user-question-generator`, where brand-grounded personas/audiences are
exactly the point (see its own `SKILL.md`) and this tension doesn't apply.

## Term clustering: an LLM call, deliberately, for one specific step

**Decision:** `src/clustering/clusterTermsByLlm.ts` (the `--method llm` path
of `term-clustering`, see its own `SKILL.md`) makes one Gemini call per
product to bucket tagcloud terms into semantic themes — the first LLM call
anywhere in this project's pipeline outside the AEO measurement itself
(`src/aeo/`). Every other extractor/scanner/generator (SEO signals, GEO
signals, tagcloud tf-idf, hook/problem scanning, question templates) is
regex/keyword-based and deterministic by explicit design, documented
repeatedly across `WORK_PLAN.md` and this file.

**Why:** The user explicitly asked for this comparison — build the
deterministic hand-curated taxonomy first (`clusterTermsByTaxonomy.ts`),
then the LLM method second, specifically to compare the two side by side.
Run against real data for Linear: the taxonomy method left 33 of the top-50
terms unclustered (a fixed keyword list can't cover everything without
constant re-authoring); the LLM method left only 7, with sensible theme
names it invented itself ("Project & Issue Tracking," "Development &
Code") rather than picking from a fixed list. That's a real, demonstrated
tradeoff, not a hypothetical one — genuine semantic coverage in exchange for
non-determinism and a per-product API cost.

**What was left out:** No validation beyond "does the response parse as the
expected JSON shape and only reference terms that were actually in the
input" (`clusterTermsByLlm.ts` drops any invented term rather than
fabricating it into the output). No caching/reuse of a previous LLM
clustering run if the tagcloud hasn't changed — every `--method llm`
invocation re-spends a Gemini call. No mechanism to detect when the LLM's
theme names drift in wording between runs (e.g. "AI & Automation" vs. "AI &
Automation Tools") in a way that would make repeated re-clustering look
falsely unstable; the dashboard's method-comparison note only compares
theme/unclustered *counts*, not name-level alignment.

## SEO/GEO/AEO composite scores: heuristic weights, not empirically derived

**Decision:** Each dimension is reduced to a single 0-100 score via a
weighted blend of sub-signals. AEO score = `60% × (brand Share of Voice ×
100) + 40% × (sentiment normalized to 0-100)` (`computeAeoScore` in
`src/aeo/reportGenerator.ts`). SEO and GEO scores are unweighted (25/25/25/25)
averages of four sub-scores each, and GEO's E-E-A-T sub-score itself splits
33/33/34 across author/publish-date/updated-date presence. These weights ship
as-is and drive the three `ScoreBadge`s shown on the home page and each
product page's executive summary.

**Why:** The brief doesn't mandate a specific scoring formula — it asks (in
the original Spanish) "¿con qué criterios lo medirías?" ("what criteria
would you measure it with?") and leaves the criteria to the candidate. A
single blended number per dimension is a legible answer to that question, and
it was implemented as ordinary rules-based engineering judgment (documented
in `.claude/skills/brand-visibility-audit/SKILL.md`'s "Metric formulas"
section) rather than derived from any external AEO/SEO/GEO scoring standard,
published study, or calibration against a real outcome (e.g. does a 10-point
AEO increase correlate with more actual AI-referral traffic?). No such ground
truth exists for this project to fit the weights against, so none of these
splits — 60/40, 25/25/25/25, or 33/33/34 — should be read as validated;
they're a starting point, not a finding.

**What was left out:** No sensitivity analysis across alternative weightings,
no A/B of 60/40 against e.g. 50/50, and no attempt to calibrate any of these
splits against outcome data. This is a matter of methodological discussion,
not a settled fact — reporting Share of Voice and sentiment unblended
instead of compressing them into one number is an equally defensible choice.
The raw components (SoV%, sentiment score, avg factual density, avg
extractable structure, etc.) are always shown unblended alongside the
composite in the same report tables specifically so no one has to take the
composite on faith. Reweighting or dropping these composites in favor of raw
criteria was considered and deliberately deferred rather than changed under
deadline pressure this close to submission.

## Persona Inference Effort Index (PIEI) — proposed, not built

**Problem it solves:** there are two ways a site communicates its user
persona: **explicitly** (the site says it directly: "built for agile
engineering teams") or **implicitly** (the LLM has to infer it by combining
indirect signals — copy tone, listed features, offered integrations, blog
use cases — without anyone stating it in a single sentence). The more the
LLM has to infer, the higher the risk that the inference is inconsistent
across runs or across different models, and the less control the brand has
over how it's perceived.

The proposed index (PIEI) is built from 4 measurable components:

1. **Explicit Mention Rate (EMR)** — does the site state the persona/use
   case in direct text (headings, hero copy, "Who it's for" sections)? Measured
   via semantic/keyword analysis over the key pages (home, pricing,
   landing), looking for phrases like "for [role]", "ideal for", "designed
   for", "built for". A coverage score per page.

2. **Reasoning Chain Length (RCL)** — the LLM is asked: *"What type of
   user/team is this product intended for, based only on this content?"*,
   and asked to show its reasoning by citing evidence. Count how many
   distinct pieces of evidence it had to combine to reach the conclusion (1
   piece = minimal inference; 4-5 pieces combined = high inference).

3. **Cross-Run Consistency (CRC)** — the same persona question is run N
   times (high temperature, same mechanism as the AEO runs). If the site is
   explicit, the LLM converges on the same answer almost every time; if it
   has to infer heavily, answers vary more across runs. Measured via
   embedding similarity between answers, or more simply, the % of runs
   where the dominant persona matches: `CRC = 1 - (variance of personas
   mentioned across runs / N)`.

4. **Self-Reported Confidence (SRC)** — the LLM is asked to score its own
   certainty from 0 to 1 about the inference it made. This is the weakest
   signal of the four (LLMs aren't perfectly calibrated on self-confidence),
   so it's used as a complement, not a primary source.

**Combined index formula:**

```
PIEI = 1 - [ (EMR × 0.35) + (CRC × 0.35) + (SRC × 0.15) + (1 - RCL_normalized × 0.15) ]
```

A **PIEI close to 0** indicates the site communicates its persona explicitly
and consistently (low inference effort, low risk). A **PIEI close to 1**
indicates the LLM has to infer heavily, with low consistency across runs
(high effort, high risk of misinterpretation by the AI engine).

The weights (0.35 / 0.35 / 0.15 / 0.15) are a reasonable starting point —
prioritizing explicitness and cross-run consistency, the most actionable
components — and are documented as adjustable, not as an empirically
validated calibration.

**Integration with the existing pipeline:** the PIEI would be computed over
the same content already extracted for SEO/GEO
(`extracted/structured_signals.json`), without requiring a new scan, and
would reuse the same repeated-Gemini-call mechanism already used for AEO,
applied to a different question ("who is this for?" instead of "what
product would you recommend?"). The result would be stored in
`/geo/persona_inference.json` as a GEO sub-metric.

**What was left out:** the full design above, with no implementation
(`geo/persona_inference.json`, the Gemini reasoning question, the
cross-run CRC calculation) — documented as future work, not as part of the
pipeline built in this exercise.

## Realism level of the E-E-A-T measurement in this exercise

**How the data is handled:** all E-E-A-T signals are extracted exclusively
from the **brand's own site via sitemap crawl** (`/raw/pages/` →
`/extracted/structured_signals.json`). No external data source is
incorporated into the pipeline (backlinks, third-party mentions, reviews on
directories like G2/Capterra, social media, press).

This has an important consequence: two of the four components of the
E-E-A-T framework are, by definition, signals **external** to the site
(reputation granted by third parties), while the pipeline can only observe
**internal** signals (what the site says about itself). The result is a
partial measurement, with a different level of fidelity per component:

| Component | What's measured with the available data | Realism level |
|---|---|---|
| **Experience** | Weak proxy: detection of testimonials, use cases, screenshots on the site — with no way to verify whether they're real experiences or marketing copy | Low-medium: measures *whether the site simulates having experience*, not whether it actually has it |
| **Expertise** | Medium proxy: technical accuracy of the copy, presence of documentation, author bio when it exists | Medium: verifiable in the text itself, but self-declared, with no external credentials confirming it |
| **Authoritativeness** | Practically not measurable — would require backlinks, external mentions, presence in recognized directories | Very low / not measurable with this pipeline: the weakest component of the implementation |
| **Trustworthiness** | The most verifiable with the available data: HTTPS, visible publish/update date, legal/"about us" page, attributed authorship — structural signals that are easy to check in the HTML | Medium-high: the only component where the measurement comes close to something reliable |

**Conclusion and declared scope:** the E-E-A-T score implemented in this
project is an **approximation based exclusively on on-page signals from the
brand's own site**. It doesn't incorporate external data, so the
Authoritativeness component is underrepresented or effectively excluded
from the aggregate score. It's a **structural proxy** — it measures whether
the site *presents the signals* typically associated with E-E-A-T — and not
a complete measurement of the construct as Google evaluates it (which
weighs external reputation signals heavily).

**What was explicitly left out of scope:** covering Authoritativeness
realistically would require integrating an external data source (a
backlinks API like Ahrefs/Moz, or scraping presence on G2/Capterra), which
was deliberately not incorporated in this exercise because it would add an
external dependency and additional complexity beyond the available
timeline. This is documented as a known limitation, not an oversight.


## Neutral prompting, brand-grounded prompting, and the awareness ladder — three deliberately different goals

**Decision:** this project runs two prompt-generation strategies against
Gemini that are deliberately different in what they measure and are never
blended into one number:

- **Neutral dynamic prompting** (`src/aeo/promptGenerator.ts`, the main AEO
  pipeline) generates prompts by combinatorially varying intent, persona,
  specificity, attribute, and language — deliberately avoiding any brand's
  own vocabulary. **Goal:** measure Share of Voice under conditions that
  don't structurally favor Linear (or any competitor) — answer "if a
  reasonably representative category-relevant user shows up with no
  brand-specific framing, who does Gemini reach for first?" This is the
  fair-benchmark number the SEO/GEO/AEO scores and priority matrix are built
  from.
- **Brand-grounded prompting** (`user-question-generator` skill,
  `src/questionGenerator/`) does the opposite on purpose: it scans Linear's
  own scraped site content and phrases candidate questions grounded in it,
  in two derivatives — hook-grounded (echoes the site's own phrasing, a
  **floor** signal: does the model even associate the brand with its own
  stated positioning?) and inferential (paraphrases the underlying
  problem/audience without quoting the site, a **stronger** signal: does the
  model infer fit from a genuinely reworded description?). **Goal:** measure
  a best-case ceiling — "on the specific angles Linear's own content is
  built to win, does the model actually credit it?" — which answers a
  content/GEO-strategy question, not a fair-comparison one.
- **The awareness-stage ladder** (`pain_only` → `problem_framed` →
  `comparing_with_criteria`, inside brand-grounded Part 2,
  `src/questionGenerator/inferentialTemplates.ts`) is a user-centered
  modeling attempt layered on top of brand-grounded prompting. Every
  template that existed before this dimension implicitly assumed the user
  already knows they want "a tool" and is just picking one. The ladder
  instead models three different places a real user could be in their
  buying journey *before they type anything*: a pure symptom/frustration
  statement with no solution ask at all (`pain_only`, the most naturalistic
  and most demanding — does the model proactively suggest the category, let
  alone the brand, when nobody asked for a recommendation?), an open
  "what's the best way to solve this" that doesn't presuppose the answer is
  a product (`problem_framed`), and a solution-aware, named comparison
  against a criterion derived from the pain point itself
  (`comparing_with_criteria`). **Goal:** avoid measuring only the easiest
  case (a user who already frames the problem as "which tool"), since that
  systematically overstates how early and how organically a brand actually
  earns a mention in a real conversation.

**Why:** neutral and brand-grounded prompting deliberately answer two
different questions so their results can be read as two data points instead
of one blended, misleading one (see `brand-visibility-audit`'s "Brand-
grounded vs. neutral — never compare these directly" and the persona-
inference neutrality tension above). A low neutral SoV next to a high
brand-grounded SoV isn't a contradiction — it's evidence that the brand's
own positioning is legible to the model *when surfaced*, but isn't winning
the fair, category-wide comparison, which points at a distribution/
visibility problem rather than a positioning problem, and vice versa. The
awareness ladder exists for the same reason applied one level deeper: a
user who has already decided to compare named tools is a later, rarer, and
lower-leverage moment than a user who just described a symptom — testing
only the former (which is what a flat template list did before this
dimension was added) would flatter any brand's measured visibility relative
to how it actually shows up across the range of ways real users approach an
AI assistant.

**What was left out:** all three awareness stages currently re-wrap the
*same* scanned problem clause in a different frame rather than genuinely
re-deriving what a user at that specific stage would say — a real
`pain_only` complaint and a real `comparing_with_criteria` question would
likely emphasize different aspects of the same underlying issue. Audience
detection for the ladder's audience-requiring variants is a small curated
keyword list, not learned from the site. See `user-question-generator`'s
own "Known limitations" for the full list (frequency-vs-distinctiveness,
single-page hook dedup, regex-only problem extraction, non-relevance-matched
competitor pairing).
