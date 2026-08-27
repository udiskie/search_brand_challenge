import type { CandidateQuestion, InferentialQuestion, ProblemClaim, ProductHook } from "./types";

function renderHookSection(hooks: ProductHook[], questions: CandidateQuestion[]): string[] {
  const lines: string[] = [];
  lines.push(
    "## Part 1: Direct hook-grounded questions",
    "",
    "Quotes or closely echoes phrasing the site itself uses. A model surfacing the brand here " +
      "may just be recognizing indexed text, not reasoning about fit -- treat these as a floor " +
      '(\"does the model even associate the brand with its own stated positioning?\"), not proof ' +
      "of real-world AEO strength.",
    ""
  );

  for (const hook of hooks) {
    lines.push(`### Hook: "${hook.hook}"`, "");
    lines.push(`Source: \`${hook.source}\` (document frequency: ${hook.documentFrequency})`);
    if (hook.evidence.length > 0) {
      lines.push("", "Evidence:");
      for (const e of hook.evidence) {
        lines.push(`- [${e.url}](${e.url}): "${e.snippet.slice(0, 160)}"`);
      }
    }
    lines.push("", "Candidate questions:");
    for (const q of questions.filter((question) => question.hook === hook.hook)) {
      lines.push(`- ${q.text}`);
    }
    lines.push("");
  }

  return lines;
}

function renderInferentialSection(
  claims: ProblemClaim[],
  questions: InferentialQuestion[]
): string[] {
  const lines: string[] = [];
  lines.push(
    "## Part 2: Inferential questions (paraphrased, no site quoting)",
    "",
    "Phrases the extracted problem (and detected audience) as a generic user need -- never quotes " +
      "the site. A model surfacing the brand here requires genuinely inferring fit from the " +
      "problem/audience description, which is a stronger visibility signal than Part 1.",
    ""
  );

  for (const claim of claims) {
    const audience =
      [...claim.audience.userTypes, ...claim.audience.orgTypes].join(", ") || "(none detected)";
    lines.push(`### Problem: "${claim.problem}"`, "");
    lines.push(`Audience detected: ${audience}`);
    if (claim.evidence.length > 0) {
      lines.push("", "Evidence:");
      for (const e of claim.evidence.slice(0, 3)) {
        lines.push(`- [${e.url}](${e.url}): "${e.snippet.slice(0, 160)}"`);
      }
    }
    lines.push("", "Candidate questions:");
    for (const q of questions.filter((question) => question.problem === claim.problem)) {
      lines.push(`- ${q.text}`);
    }
    lines.push("");
  }

  return lines;
}

/** Full human-readable listing: hook-grounded questions, then inferential ones, for review. */
export function renderQuestionsMarkdown(
  brand: string,
  hooks: ProductHook[],
  hookQuestions: CandidateQuestion[],
  claims: ProblemClaim[],
  inferentialQuestions: InferentialQuestion[]
): string {
  const lines: string[] = [];
  lines.push(`# Candidate user questions grounded in ${brand}'s own site content`, "");
  lines.push(
    `${hooks.length} hooks and ${claims.length} problem/audience claims scanned from the data lake, ` +
      `${hookQuestions.length + inferentialQuestions.length} candidate questions generated across two ` +
      "derivatives -- review before using any of these as real AEO probes.",
    ""
  );
  lines.push(...renderHookSection(hooks, hookQuestions));
  lines.push(...renderInferentialSection(claims, inferentialQuestions));

  return lines.join("\n");
}
