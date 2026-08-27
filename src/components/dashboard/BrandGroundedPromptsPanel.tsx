"use client";

import { useMemo, useState } from "react";
import type { BrandGroundedRunResult } from "@/aeo/types";
import { Badge } from "@/components/ui/badge";
import { Panel } from "./Panel";
import { RunOutcome } from "./RunOutcome";
import { TagCheckboxFilter, type TagFilterGroup } from "./TagCheckboxFilter";

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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function tagsForGroup(group: BrandGroundedGroup): string[] {
  const tags = [`source:${group.source}`];
  if (group.stage) tags.push(`stage:${group.stage}`);
  return tags;
}

export function BrandGroundedPromptsPanel({ runs }: { runs: BrandGroundedRunResult[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupBrandGroundedRuns(runs), [runs]);

  const filterGroups: TagFilterGroup[] = useMemo(
    () => [
      {
        label: "Source",
        options: uniqueSorted(groups.map((g) => g.source)).map((v) => ({
          key: `source:${v}`,
          label: v,
        })),
      },
      {
        label: "Awareness stage",
        options: uniqueSorted(groups.filter((g) => g.stage).map((g) => g.stage as string)).map(
          (v) => ({ key: `stage:${v}`, label: v })
        ),
      },
    ],
    [groups]
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
    if (selected.size === 0) return groups;
    return groups.filter((group) => {
      const tags = new Set(tagsForGroup(group));
      return [...selected].every((tag) => tags.has(tag));
    });
  }, [groups, selected]);

  return (
    <Panel title={`Brand-grounded prompts (${runs.length} runs)`}>
      <TagCheckboxFilter groups={filterGroups} selected={selected} onToggle={toggle} />
      <p className="mt-2 mb-4 text-xs text-muted-foreground">
        Showing {items.length} of {groups.length}
      </p>
      <div className="space-y-4">
        {items.map((group) => (
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
