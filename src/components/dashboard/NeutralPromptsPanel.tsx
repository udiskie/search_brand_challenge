"use client";

import { useMemo, useState } from "react";
import type { GeminiRunResult, GeneratedPrompt } from "@/aeo/types";
import { Badge } from "@/components/ui/badge";
import { Panel } from "./Panel";
import { RunOutcome } from "./RunOutcome";
import { SortSelect, type SortOption } from "./SortSelect";

type SortKey = "default" | "intent" | "specificity" | "language" | "runs-desc" | "runs-asc" | "text";

const SORT_OPTIONS: SortOption<SortKey>[] = [
  { value: "default", label: "Generation order" },
  { value: "intent", label: "Intent" },
  { value: "specificity", label: "Specificity" },
  { value: "language", label: "Language" },
  { value: "runs-desc", label: "Runs (most first)" },
  { value: "runs-asc", label: "Runs (fewest first)" },
  { value: "text", label: "Prompt text (A–Z)" },
];

export function NeutralPromptsPanel({
  prompts,
  runs,
  runsPerPrompt,
}: {
  prompts: GeneratedPrompt[];
  runs: GeminiRunResult[];
  runsPerPrompt: number;
}) {
  const [sort, setSort] = useState<SortKey>("default");

  const items = useMemo(() => {
    const withRuns = prompts.map((prompt, index) => ({
      prompt,
      index,
      runs: runs.filter((run) => run.promptId === prompt.id),
    }));

    withRuns.sort((a, b) => {
      switch (sort) {
        case "intent":
          return a.prompt.dimensions.intent.localeCompare(b.prompt.dimensions.intent);
        case "specificity":
          return a.prompt.dimensions.specificity.localeCompare(b.prompt.dimensions.specificity);
        case "language":
          return a.prompt.dimensions.language.localeCompare(b.prompt.dimensions.language);
        case "runs-desc":
          return b.runs.length - a.runs.length;
        case "runs-asc":
          return a.runs.length - b.runs.length;
        case "text":
          return a.prompt.text.localeCompare(b.prompt.text);
        default:
          return a.index - b.index;
      }
    });

    return withRuns;
  }, [prompts, runs, sort]);

  return (
    <Panel
      title={`Neutral AEO prompts (${prompts.length} prompts × ${runsPerPrompt} runs)`}
      action={<SortSelect value={sort} onChange={setSort} options={SORT_OPTIONS} />}
    >
      <div className="space-y-4">
        {items.map(({ prompt, runs: promptRuns }) => (
          <div key={prompt.id} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
            <p className="text-sm font-medium">{prompt.text}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{prompt.dimensions.intent}</Badge>
              <Badge variant="outline">{prompt.dimensions.specificity}</Badge>
              <Badge variant="outline">{prompt.dimensions.language}</Badge>
              <Badge variant="secondary">
                {promptRuns.length} run{promptRuns.length === 1 ? "" : "s"}
              </Badge>
            </div>
            {promptRuns.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {promptRuns.map((run) => (
                  <li key={run.runId}>
                    <RunOutcome run={run} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
