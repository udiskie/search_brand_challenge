# Brand Visibility Audit (SEO / GEO / AEO)

A [Next.js](https://nextjs.org) project (bootstrapped with
[`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app))
that scrapes a brand's site, probes Gemini with generated prompts, and
reports how visible that brand is against named competitors across SEO,
GEO, and AEO. See `WORK_PLAN.md` for the full brief and folder layout, and
`DECISIONS.md` for what was decided/assumed/left out and why.

## Scope

This exercise is scoped around one core question — what would a real user
type into an LLM (Gemini, the only engine implemented) such that the
model's answer plausibly mentions Linear by name? Every pipeline
component — the site scraper feeding SEO/GEO signals, the neutral AEO
prompt set (`src/aeo/promptGenerator.ts`), the brand-grounded question
generator (`src/questionGenerator/`), and the resulting Share-of-
Voice/position/sentiment metrics — exists to profile that single question
from different angles, not to build a general-purpose prompt-engineering,
SEO, or content-marketing tool in its own right.

The brief asks how visible Linear is when a category-relevant question is
put to an AI engine, relative to named competitors. Treating "what prompt
would make Gemini say Linear" as the organizing question keeps every other
piece of the pipeline in service of one measurable outcome — Gemini's
*response* is the object being studied, with the site's own SEO/GEO signals
treated as inputs that plausibly explain why a prompt does or doesn't
surface the brand, not as an end in themselves.

Other engines (ChatGPT, Perplexity, Claude, AI Overviews, etc.) are
explicitly out of scope — only Gemini's REST API is implemented (see
`brand-visibility-audit`'s `SKILL.md`). Multi-turn conversations are also
out of scope; every probe is a single-turn prompt, so this project says
nothing about whether Linear holds up (or fades) as a conversation
continues. See `DECISIONS.md`'s "Scope" entry for the full reasoning.

## Getting Started

Requires Node >=20.19 (`nvm use` if you have an older default — vite/vitest's
native bindings don't resolve on older 20.x).

```bash
git clone git@github.com:udiskie/search_brand_challenge.git
cd search_brand_challenge
npm install
```

Copy `.env.example` to `.env.local` and set your own Gemini API key (get one
at https://aistudio.google.com/apikey):

```bash
cp .env.example .env.local
# then edit .env.local and set GEMINI_API_KEY=...
```

`.env.local` is gitignored and loaded automatically by both the Next.js app
and every CLI below, so the key never needs to be typed inline or committed.
It's only required for the AEO probe (`npm run aeo`) and the term-clustering
LLM method (`npm run clusters -- --method llm`) — the dashboard itself reads
already-committed `datalake/` data and runs fine without a key. This also
means `GEMINI_API_KEY` doesn't need to be configured on the Vercel
deployment: the deployed app has no API routes and never calls Gemini at
request time, it only serves the committed `datalake/` JSON — Gemini is
only ever called from these CLIs, run locally.

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see
the dashboard — it already has quick-mode data committed for Linear and its
AEO competitors (Jira, Asana, Monday, Notion), so there's a report to look at
immediately without running any CLI first.

## Relevant links

Once the dev server is running, these are the pages worth a look (swap
`linear` for `jira`/`asana`/`monday`/`notion`, the other products with
committed data):

- [`/decisions`](http://localhost:3000/decisions) — the full decisions log
  (`DECISIONS.md`), rendered
- [`/docs`](http://localhost:3000/docs) — documentation hub: data lake
  structure, Claude Code skills in use, prompt generation, and the
  [assessment methodology](http://localhost:3000/methodology)
- [`/products/linear/questions`](http://localhost:3000/products/linear/questions) —
  candidate user questions (hook-grounded and inferential, across the
  awareness ladder)
- [`/products/linear/prompts`](http://localhost:3000/products/linear/prompts) —
  every prompt actually sent to Gemini (neutral AEO + brand-grounded) and
  its raw runs
- [`/products/linear/clusters`](http://localhost:3000/products/linear/clusters) —
  tagcloud terms grouped into named semantic themes (taxonomy vs. LLM
  clustering methods, compared)

## Data lake scraper

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

Requires `GEMINI_API_KEY` set in `.env.local` — see Getting Started above.

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

Optionally, also probe Part 1/Part 2 questions from the user question
generator (below) as a third, explicitly non-neutral prompt source:

```bash
npm run aeo -- \
  --product <name> --brand <Brand> --competitors <A,B,C> --category "<category>" \
  --include-questions hooks|inferential|both [--questions-runs 2] [--questions-limit N]
```

Requires `npm run questions` to have been run for that product first.
Results land in a separate `## Brand-grounded question performance` report
section and `aeo/brand_grounded_metrics.json` — never blended into the
neutral AEO scores, since these questions are deliberately brand-grounded,
not neutral (see the skill's SKILL.md for why that distinction matters).

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
