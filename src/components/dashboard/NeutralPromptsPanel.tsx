"use client";

import { useMemo, useState } from "react";
import type { GeminiRunResult, GeneratedPrompt } from "@/aeo/types";
import { Badge } from "@/components/ui/badge";
import { Panel } from "./Panel";
import { RunOutcome } from "./RunOutcome";
import { TagCheckboxFilter, type TagFilterGroup } from "./TagCheckboxFilter";

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function tagsForPrompt(prompt: GeneratedPrompt): string[] {
  return [
    `intent:${prompt.dimensions.intent}`,
    `specificity:${prompt.dimensions.specificity}`,
    `language:${prompt.dimensions.language}`,
  ];
}

export function NeutralPromptsPanel({
  prompts,
  runs,
  runsPerPrompt,
}: {
  prompts: GeneratedPrompt[];
  runs: GeminiRunResult[];
  runsPerPrompt: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groups: TagFilterGroup[] = useMemo(
    () => [
      {
        label: "Intent",
        options: uniqueSorted(prompts.map((p) => p.dimensions.intent)).map((v) => ({
          key: `intent:${v}`,
          label: v,
        })),
      },
      {
        label: "Specificity",
        options: uniqueSorted(prompts.map((p) => p.dimensions.specificity)).map((v) => ({
          key: `specificity:${v}`,
          label: v,
        })),
      },
      {
        label: "Language",
        options: uniqueSorted(prompts.map((p) => p.dimensions.language)).map((v) => ({
          key: `language:${v}`,
          label: v,
        })),
      },
    ],
    [prompts]
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const items = useMemo(() => {
    const withRuns = prompts.map((prompt) => ({
      prompt,
      runs: runs.filter((run) => run.promptId === prompt.id),
    }));
    if (selected.size === 0) return withRuns;
    const promptTags = tagsForPrompt;
    return withRuns.filter(({ prompt }) => {
      const tags = new Set(promptTags(prompt));
      return [...selected].every((tag) => tags.has(tag));
    });
  }, [prompts, runs, selected]);

  return (
    <Panel title={`Neutral AEO prompts (${prompts.length} prompts × ${runsPerPrompt} runs)`}>
      <TagCheckboxFilter groups={groups} selected={selected} onToggle={toggle} />
      <p className="mt-2 mb-4 text-xs text-muted-foreground">
        Showing {items.length} of {prompts.length}
      </p>
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
