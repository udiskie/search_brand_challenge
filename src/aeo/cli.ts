#!/usr/bin/env node
import { runAeoAudit } from "./run";
import type { AeoAuditConfig } from "./types";

const USAGE =
  "Usage: npm run aeo -- --product <name> --brand <Brand> --competitors <A,B,C> " +
  "--category <category> [--url <site>] [--mode quick|full] [--model gemini-2.0-flash] " +
  "[--prompts 20] [--runs 5] [--temperature 0.9]";

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

  if (!args.product || !args.brand || !args.competitors || !args.category) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    process.exitCode = 1;
    return;
  }

  const mode = args.mode === "full" ? "full" : "quick";
  const promptCount = args.prompts ? Number(args.prompts) : mode === "full" ? 24 : 10;
  const runsPerPrompt = args.runs ? Number(args.runs) : mode === "full" ? 6 : 3;
  const temperature = args.temperature ? Number(args.temperature) : 0.9;
  const model = args.model ?? "gemini-2.0-flash";

  const auditConfig: AeoAuditConfig = {
    brand: args.brand,
    competitors: args.competitors
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
    category: args.category,
    promptCount,
    runsPerPrompt,
    temperature,
    model,
  };

  const summary = await runAeoAudit({
    product: args.product,
    auditConfig,
    geminiConfig: {
      apiKey,
      model,
      temperature,
      timeoutMs: args.timeout ? Number(args.timeout) : 15_000,
      maxRetries: args.retries ? Number(args.retries) : 2,
      concurrency: args.concurrency ? Number(args.concurrency) : 3,
      requestDelayMs: args.delay ? Number(args.delay) : 500,
    },
    siteUrl: args.url,
    scrapeMode: mode,
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
