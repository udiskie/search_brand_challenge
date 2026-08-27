#!/usr/bin/env node
import path from "node:path";
import { productDir, writeJson, writeText } from "../scraper/datalake";
import { scanProductHooks } from "./datalakeScanner";
import { renderQuestionsMarkdown } from "./render";
import { generateCandidateQuestions } from "./templates";

const USAGE = "Usage: npm run questions -- --product <name> --brand <Brand>";

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

  if (!args.product || !args.brand) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const hooks = await scanProductHooks(args.product, { excludeTerms: [args.brand] });
  const questions = generateCandidateQuestions(hooks);

  const outDir = path.join(productDir(args.product), "questions");
  await writeJson(path.join(outDir, "candidate_user_questions.json"), { hooks, questions });
  await writeText(
    path.join(outDir, "candidate_user_questions.md"),
    renderQuestionsMarkdown(args.brand, hooks, questions)
  );

  console.log(
    JSON.stringify(
      { product: args.product, hookCount: hooks.length, questionCount: questions.length },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
