# Decisions

What was decided, what was assumed, and what was deliberately left out of
scope for this exercise — and why.

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
