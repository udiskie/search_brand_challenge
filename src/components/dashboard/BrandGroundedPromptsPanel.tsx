"use client";

import { useMemo, useState } from "react";
import type { BrandGroundedRunResult } from "@/aeo/types";
import { Badge } from "@/components/ui/badge";
import { Panel } from "./Panel";
import { RunOutcome } from "./RunOutcome";
import { SortSelect, type SortOption } from "./SortSelect";

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

type SortKey = "default" | "source" | "stage" | "runs-desc" | "runs-asc" | "text";

const SORT_OPTIONS: SortOption<SortKey>[] = [
  { value: "default", label: "Generation order" },
  { value: "source", label: "Source" },
  { value: "stage", label: "Awareness stage" },
  { value: "runs-desc", label: "Runs (most first)" },
  { value: "runs-asc", label: "Runs (fewest first)" },
  { value: "text", label: "Prompt text (A–Z)" },
];

export function BrandGroundedPromptsPanel({ runs }: { runs: BrandGroundedRunResult[] }) {
  const [sort, setSort] = useState<SortKey>("default");

  const groups = useMemo(() => groupBrandGroundedRuns(runs), [runs]);

  const items = useMemo(() => {
    const withIndex = groups.map((group, index) => ({ group, index }));

    withIndex.sort((a, b) => {
      switch (sort) {
        case "source":
          return a.group.source.localeCompare(b.group.source);
        case "stage":
          return (a.group.stage ?? "").localeCompare(b.group.stage ?? "");
        case "runs-desc":
          return b.group.runs.length - a.group.runs.length;
        case "runs-asc":
          return a.group.runs.length - b.group.runs.length;
        case "text":
          return a.group.text.localeCompare(b.group.text);
        default:
          return a.index - b.index;
      }
    });

    return withIndex;
  }, [groups, sort]);

  return (
    <Panel
      title={`Brand-grounded prompts (${runs.length} runs)`}
      action={<SortSelect value={sort} onChange={setSort} options={SORT_OPTIONS} />}
    >
      <div className="space-y-4">
        {items.map(({ group }) => (
          <div key={group.promptId} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
            <p className="text-sm font-medium">{group.text}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{group.source}</Badge>
              {group.stage ? <Badge variant="outline">{group.stage}</Badge> : null}
              <Badge variant="secondary">
                {group.runs.length} run{group.runs.length === 1 ? "" : "s"}
              </Badge>
            </div>
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
  );
}
