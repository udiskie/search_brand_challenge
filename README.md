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

Run the scraper's test suite with:

```bash
npm test
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
