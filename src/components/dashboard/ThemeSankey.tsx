"use client";

import { Sankey, Tooltip, type SankeyNodeProps } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { Theme } from "@/clustering/types";

const chartConfig = {} satisfies ChartConfig;

const HAS_QUESTIONS = "Has candidate questions";
const NO_QUESTIONS = "No candidate questions yet";
const MENTIONED = "Mentioned in Gemini's answers";
const NOT_MENTIONED = "Never mentioned in answers";

/** How far a node sits from the theme (leftmost) column -- decides which
 * side its label is drawn on, since the rightmost column would otherwise
 * spill its label text past the chart's edge. */
type SankeyNodeDatum = { name: string; column: 0 | 1 | 2 };

/** Recharts' default Sankey node renderer draws only the bar, no label --
 * this is the custom renderer that actually names each node. */
function SankeyNodeLabel(props: SankeyNodeProps) {
  const { x, y, width, height } = props;
  const payload = props.payload as unknown as SankeyNodeDatum;
  const isRightColumn = payload.column === 2;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="var(--color-chart-1)" stroke="var(--border)" />
      <text
        x={isRightColumn ? x - 6 : x + width + 6}
        y={y + height / 2}
        dy="0.32em"
        textAnchor={isRightColumn ? "end" : "start"}
        fontSize={11}
        fill="var(--foreground)"
      >
        {payload.name}
      </text>
    </g>
  );
}

/**
 * Theme -> question coverage -> answer-mention outcome, as a Sankey flow.
 * Chosen over a generic force-directed node-link graph (evaluated and
 * rejected -- see WORK_PLAN.md/term-clustering SKILL.md): with 100+
 * candidate questions, a force-directed graph gets cluttered fast and
 * doesn't answer the actual question a user has here, which is a
 * flow/conversion one -- which themes we generate questions about but
 * Gemini never actually surfaces (a clustering-level GEO gap), vs. which
 * themes show up in answers unprompted. A Sankey answers that directly
 * while still being graph-like (nodes + weighted links).
 */
export function ThemeSankey({ themes }: { themes: Theme[] }) {
  const withTerms = themes.filter((t) => t.terms.length > 0);
  if (withTerms.length === 0) return null;

  const themeNodes: SankeyNodeDatum[] = withTerms.map((t) => ({ name: t.name, column: 0 }));
  const bucketNodes: SankeyNodeDatum[] = [
    { name: HAS_QUESTIONS, column: 1 },
    { name: NO_QUESTIONS, column: 1 },
    { name: MENTIONED, column: 2 },
    { name: NOT_MENTIONED, column: 2 },
  ];
  const nodes = [...themeNodes, ...bucketNodes];

  const hasQuestionsIdx = withTerms.length;
  const noQuestionsIdx = withTerms.length + 1;
  const mentionedIdx = withTerms.length + 2;
  const notMentionedIdx = withTerms.length + 3;

  // Recharts' Sankey renders one link per data entry and keys it off
  // source/target -- multiple themes routing through the same bucket pair
  // (e.g. two themes both "has questions" -> "mentioned") would otherwise
  // push separate link entries with an identical source/target, producing
  // duplicate React keys and stacked/overlapping arcs instead of one arc
  // whose width reflects the combined flow. Aggregate by source-target
  // pair and sum the weight so each pair appears as a single link.
  const linksByPair = new Map<string, { source: number; target: number; value: number }>();
  function addLink(source: number, target: number, value: number) {
    const key = `${source}-${target}`;
    const existing = linksByPair.get(key);
    if (existing) existing.value += value;
    else linksByPair.set(key, { source, target, value });
  }

  withTerms.forEach((theme, i) => {
    const weight = Math.max(1, theme.terms.length);
    const hasQuestions = theme.questions.length > 0;
    const mentioned =
      theme.neutralAnswers.runsMentioning > 0 || theme.brandGroundedAnswers.runsMentioning > 0;

    const questionBucket = hasQuestions ? hasQuestionsIdx : noQuestionsIdx;
    const mentionBucket = mentioned ? mentionedIdx : notMentionedIdx;

    addLink(i, questionBucket, weight);
    addLink(questionBucket, mentionBucket, weight);
  });

  const links = [...linksByPair.values()];

  return (
    <ChartContainer config={chartConfig} className="h-80 w-full">
      <Sankey
        data={{ nodes, links }}
        nodePadding={16}
        nodeWidth={10}
        margin={{ top: 8, right: 170, bottom: 8, left: 8 }}
        link={{ stroke: "var(--color-chart-2)", strokeOpacity: 0.4 }}
        node={SankeyNodeLabel}
      >
        <Tooltip
          formatter={(value) => [`${value}`, "weight"]}
          contentStyle={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
      </Sankey>
    </ChartContainer>
  );
}
