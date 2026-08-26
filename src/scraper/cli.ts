#!/usr/bin/env node
import type { CrawlMode, ScrapeConfig } from "./types";
import { runScrape } from "./run";

const USAGE =
  "Usage: npm run scrape -- --product <name> --url <https://site> " +
  "[--mode quick|full] [--quick-cap 15] [--concurrency 3] [--delay 300]";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.product || !args.url) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const mode: CrawlMode = args.mode === "full" ? "full" : "quick";

  const config: ScrapeConfig = {
    product: args.product,
    siteUrl: args.url,
    mode,
    quickPageCap: args["quick-cap"] ? Number(args["quick-cap"]) : 15,
    concurrency: args.concurrency ? Number(args.concurrency) : 3,
    requestDelayMs: args.delay ? Number(args.delay) : 300,
    timeoutMs: 10_000,
    maxRetries: 2,
    userAgent:
      "search-brand-datalake-scraper/0.1 (brand visibility audit scraper)",
  };

  const summary = await runScrape(config);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
