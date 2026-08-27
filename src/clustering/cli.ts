#!/usr/bin/env node
import { runTermClustering } from "./run";
import type { ClusteringMethod } from "./types";

const USAGE =
  "Usage: npm run clusters -- --product <name> [--method taxonomy|llm]\n" +
  "  Buckets the product's tagcloud terms into named themes and correlates\n" +
  "  them against candidate questions and Gemini's raw answers. Requires\n" +
  "  `npm run scrape` to have been run for this product first.";

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

  if (!args.product) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const method = (args.method ?? "taxonomy") as ClusteringMethod;
  if (method !== "taxonomy" && method !== "llm") {
    console.error('--method must be "taxonomy" or "llm"');
    process.exitCode = 1;
    return;
  }

  const clustering = await runTermClustering(args.product, method);
  console.log(
    JSON.stringify(
      {
        product: clustering.product,
        method: clustering.method,
        themeCount: clustering.themes.length,
        unclusteredCount: clustering.unclustered.length,
        themes: clustering.themes.map((t) => ({
          name: t.name,
          termCount: t.terms.length,
          questionCount: t.questions.length,
          neutralRunsMentioning: t.neutralAnswers.runsMentioning,
          brandGroundedRunsMentioning: t.brandGroundedAnswers.runsMentioning,
        })),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
