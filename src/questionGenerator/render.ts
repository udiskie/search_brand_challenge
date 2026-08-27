import type { CandidateQuestion, ProductHook } from "./types";

/** Human-readable listing grouped by hook, with evidence, for quick review. */
export function renderQuestionsMarkdown(
  brand: string,
  hooks: ProductHook[],
  questions: CandidateQuestion[]
): string {
  const lines: string[] = [];
  lines.push(`# Candidate user questions grounded in ${brand}'s own site content`);
  lines.push("");
  lines.push(
    `${hooks.length} hooks scanned from the data lake, ${questions.length} candidate questions generated. ` +
      "Each question is built to plausibly elicit a mention of the brand because it's grounded in " +
      "language the brand's own site actually uses -- review before using any of these as real AEO probes."
  );
  lines.push("");

  for (const hook of hooks) {
    lines.push(`## Hook: "${hook.hook}"`);
    lines.push("");
    lines.push(`Source: \`${hook.source}\` (document frequency: ${hook.documentFrequency})`);
    if (hook.evidence.length > 0) {
      lines.push("");
      lines.push("Evidence:");
      for (const e of hook.evidence) {
        lines.push(`- [${e.url}](${e.url}): "${e.snippet.slice(0, 160)}"`);
      }
    }
    lines.push("");
    lines.push("Candidate questions:");
    for (const q of questions.filter((question) => question.hook === hook.hook)) {
      lines.push(`- ${q.text}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
