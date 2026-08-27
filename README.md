This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Data lake scraper

Requires Node >=20.19 (`nvm use` if you have an older default — vite/vitest's
native bindings don't resolve on older 20.x). Run:

```bash
npm run scrape -- --product <name> --url <https://site> [--mode quick|full] [--quick-cap 15] [--concurrency 3] [--delay 300]
```

This crawls the site's sitemap and writes SEO + GEO signals, a tf-idf
tagcloud/phrase cloud, and the raw crawled pages into `datalake/{product}/`
(see `WORK_PLAN.md` for the full folder layout). Quick mode (default) caps
the crawl to a prioritized subset of pages (home, pricing, docs, blog);
full mode crawls the entire sitemap. `datalake/` already has quick-mode
output committed for Linear and its AEO competitors (Jira via
atlassian.com, Asana, Monday, Notion) as evidence — re-run the command
above to refresh it.

## AEO/GEO/SEO brand visibility audit

Copy `.env.example` to `.env.local` and set your own key (get one at
https://aistudio.google.com/apikey) — `.env.local` is gitignored and loaded
automatically by the CLI below, so the key never needs to be typed inline or
committed.

Once a product has scraper output in `datalake/{product}/` (see above),
generate the consolidated report with:

```bash
npm run aeo -- \
  --product <name> --brand <Brand> --competitors <A,B,C> --category "<category>" \
  [--url <https://site>] [--mode quick|full]
```

`--url` is only needed if the scraper hasn't been run for that product yet —
this command will scrape it first automatically in that case. It generates
a dynamic AEO prompt set, calls the Gemini REST API `runsPerPrompt` times per
prompt (to sample its non-determinism rather than treat one call as
representative), computes Share of Voice/position/sentiment metrics per
brand, cross-validates against the site's own tagcloud, and writes
`datalake/{product}/report/report.md` (plus `report.json`/`priorities.json`).

See `.claude/skills/brand-visibility-audit/SKILL.md` for the full procedure,
every metric's formula, and known limitations.

Run the full test suite (scraper + AEO) with:

```bash
npm test
```

## User question generator (early development)

Scans a product's scraper output and generates two derivatives of
candidate end-user-style questions — the opposite goal of the AEO prompt
generator above (neutral benchmarking vs. brand-grounded questions likely
to elicit an organic mention): **hook-grounded** questions that echo the
site's own phrasing (a weaker "floor" signal — a pass may just mean the
model recognized indexed text), and **inferential** questions that
paraphrase the problem the product claims to solve, for whom, without
quoting the site at all (a stronger signal — requires genuine inference).
The inferential derivative spans three points on the awareness ladder:
pain-only (no solution ask), problem-framed (open "what's the best way"),
and comparing-with-criteria (named-option comparison, using `--competitors`).

```bash
npm run questions -- --product <name> --brand <Brand> [--competitors <A,B,...>]
```

Writes `datalake/{product}/questions/candidate_user_questions.{json,md}`
(the `.md` is split into Part 1/Part 2 matching the two derivatives). See
`.claude/skills/user-question-generator/SKILL.md` for how each is scanned
and built, and known limitations (this is an early increment, not yet
wired into the AEO measurement pipeline).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
