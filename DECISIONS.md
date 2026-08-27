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
