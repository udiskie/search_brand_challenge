"use client";

import { Treemap } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { Theme } from "@/clustering/types";

const chartConfig = { size: { label: "Combined term score" } } satisfies ChartConfig;

const PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

/** Relative theme "size" (sum of term tf-idf scores) -- how much of the site's vocabulary each theme covers. */
export function ThemeTreemap({ themes }: { themes: Theme[] }) {
  if (themes.length === 0) return null;

  const data = themes.map((theme, i) => ({
    name: theme.name,
    size: Math.max(1, theme.terms.reduce((sum, t) => sum + t.score, 0)),
    termCount: theme.terms.length,
    fill: PALETTE[i % PALETTE.length],
  }));

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <Treemap
        data={data}
        dataKey="size"
        nameKey="name"
        stroke="var(--background)"
        isAnimationActive={false}
        content={(props) => {
          const { x, y, width, height } = props;
          const name = String(props.name ?? "");
          const fill = String(props.fill ?? PALETTE[0]);
          const termCount = Number(props.termCount ?? 0);
          if (width < 2 || height < 2) return <g />;
          return (
            <g>
              <title>{`${name}: ${termCount} term${termCount === 1 ? "" : "s"}`}</title>
              <rect x={x} y={y} width={width} height={height} fill={fill} stroke="var(--background)" />
              {width > 60 && height > 24 ? (
                <text x={x + 6} y={y + 18} className="fill-background text-xs font-medium">
                  {name}
                </text>
              ) : null}
            </g>
          );
        }}
      />
    </ChartContainer>
  );
}
