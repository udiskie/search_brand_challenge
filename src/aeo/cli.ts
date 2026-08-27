#!/usr/bin/env node
import { runAeoAudit, type BrandGroundedQuestionSource } from "./run";
import type { AeoAuditConfig } from "./types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local -- fine if GEMINI_API_KEY is already set some other way
  // (shell export, CI secret, etc.); checked explicitly below.
}

const USAGE =
  "Usage: npm run aeo -- --product <name> --brand <Brand> --competitors <A,B,C> " +
  "--category <category> [--url <site>] [--mode quick|full] [--model gemini-3.6-flash] " +
  "[--prompts 20] [--runs 5] [--temperature 0.9]\n" +
  "  [--include-questions hooks|inferential|both] [--questions-runs 2] [--questions-limit N]\n" +
  "  --include-questions runs Part 1/2 candidate questions (from `npm run questions`)\n" +
  "  through Gemini as a third, explicitly non-neutral prompt source -- requires\n" +
  "  `npm run questions` to have been run for this product first.";

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
  const model = args.model ?? "gemini-3.6-flash";

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

  const includeQuestionsSource = args["include-questions"] as
    | BrandGroundedQuestionSource
    | undefined;
  if (includeQuestionsSource && !["hooks", "inferential", "both"].includes(includeQuestionsSource)) {
    console.error('--include-questions must be "hooks", "inferential", or "both"');
    process.exitCode = 1;
    return;
  }

  const summary = await runAeoAudit({
    product: args.product,
    auditConfig,
    geminiConfig: {
      apiKey,
      model,
      temperature,
      timeoutMs: args.timeout ? Number(args.timeout) : 30_000,
      maxRetries: args.retries ? Number(args.retries) : 2,
      concurrency: args.concurrency ? Number(args.concurrency) : 3,
      requestDelayMs: args.delay ? Number(args.delay) : 500,
    },
    siteUrl: args.url,
    scrapeMode: mode,
    includeBrandGroundedQuestions: includeQuestionsSource
      ? {
          source: includeQuestionsSource,
          runsPerPrompt: args["questions-runs"] ? Number(args["questions-runs"]) : undefined,
          limit: args["questions-limit"] ? Number(args["questions-limit"]) : undefined,
        }
      : undefined,
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
