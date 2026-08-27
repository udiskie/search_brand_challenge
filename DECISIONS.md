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
