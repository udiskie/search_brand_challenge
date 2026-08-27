import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/dashboard/Panel";
import { SiteHeader } from "@/components/dashboard/SiteHeader";
import {
  getBrandGroundedRuns,
  getNeutralPromptsConfig,
  getNeutralRuns,
} from "@/lib/dashboardData";
import type { BrandGroundedRunResult } from "@/aeo/types";

function RunOutcome({ run }: { run: { error?: string; rawText: string | null } }) {
  if (run.error) {
    return <span className="text-red-700 dark:text-red-400">Error: {run.error}</span>;
  }
  const text = run.rawText ?? "";
  return <span>{text.length > 220 ? `${text.slice(0, 220)}…` : text}</span>;
}

interface BrandGroundedGroup {
  promptId: string;
  text: string;
  source: string;
  templateId: string;
  stage?: string;
  runs: BrandGroundedRunResult[];
}

function groupBrandGroundedRuns(runs: BrandGroundedRunResult[]): BrandGroundedGroup[] {
  const groups = new Map<string, BrandGroundedGroup>();
  for (const run of runs) {
    const existing = groups.get(run.promptId);
    if (existing) {
      existing.runs.push(run);
    } else {
      groups.set(run.promptId, {
        promptId: run.promptId,
        text: run.promptText,
        source: run.source,
        templateId: run.templateId,
        stage: run.stage,
        runs: [run],
      });
    }
  }
  return [...groups.values()];
}

export default async function PromptsPage(props: PageProps<"/products/[product]/prompts">) {
  const { product } = await props.params;

  const [promptsConfig, neutralRuns, brandGroundedRuns] = await Promise.all([
    getNeutralPromptsConfig(product),
    getNeutralRuns(product),
    getBrandGroundedRuns(product),
  ]);

  if (!promptsConfig && brandGroundedRuns.length === 0) notFound();

  const brandGroundedGroups = groupBrandGroundedRuns(brandGroundedRuns);

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-10">
        <div>
          <Link
            href={`/products/${product}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to report
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight capitalize">
            {product} — prompts sent to Gemini
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every prompt and raw response is saved before any parsing — this is the
            auditable dataset the metrics on the report page are computed from.
          </p>
        </div>

        {promptsConfig ? (
          <Panel
            title={`Neutral AEO prompts (${promptsConfig.prompts.length} prompts × ${promptsConfig.config.runsPerPrompt} runs)`}
          >
            <div className="space-y-4">
              {promptsConfig.prompts.map((prompt) => {
                const runs = neutralRuns.filter((run) => run.promptId === prompt.id);
                return (
                  <div
                    key={prompt.id}
                    className="border-b border-border/60 pb-4 last:border-0 last:pb-0"
                  >
                    <p className="text-sm font-medium">{prompt.text}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {prompt.dimensions.intent} · {prompt.dimensions.specificity} ·{" "}
                      {prompt.dimensions.language} · {runs.length} run
                      {runs.length === 1 ? "" : "s"}
                    </p>
                    {runs.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {runs.map((run) => (
                          <li key={run.runId}>
                            <RunOutcome run={run} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>
        ) : null}

        {brandGroundedGroups.length > 0 ? (
          <Panel title={`Brand-grounded prompts (${brandGroundedRuns.length} runs)`}>
            <div className="space-y-4">
              {brandGroundedGroups.map((group) => (
                <div
                  key={group.promptId}
                  className="border-b border-border/60 pb-4 last:border-0 last:pb-0"
                >
                  <p className="text-sm font-medium">{group.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {group.source}
                    {group.stage ? ` · ${group.stage}` : ""} · {group.runs.length} run
                    {group.runs.length === 1 ? "" : "s"}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {group.runs.map((run) => (
                      <li key={run.runId}>
                        <RunOutcome run={run} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </main>
    </div>
  );
}
