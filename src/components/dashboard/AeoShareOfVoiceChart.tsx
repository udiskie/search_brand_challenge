"use client";

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { BrandMetrics } from "@/aeo/types";

const chartConfig = {
  value: { label: "Share of Voice" },
} satisfies ChartConfig;

export interface AeoBarDatum {
  label: string;
  /** Share of Voice as a 0-1 fraction; rendered as a rounded percentage. */
  value: number;
  highlighted: boolean;
}

/**
 * Emphasis form (one hue + gray), not full categorical: the story is "how does
 * the highlighted row compare to the rest," not "tell every row apart," so
 * only two colors are needed -- the highlighted row in ink, everything else in
 * the same de-emphasis gray. Identity still comes from the axis label, never
 * color alone.
 */
export function AeoEmphasisBarChart({
  data,
  legend,
}: {
  data: AeoBarDatum[];
  legend: { highlighted: string; rest: string };
}) {
  if (data.length === 0) return null;

  const rows = [...data]
    .sort((a, b) => b.value - a.value)
    .map((d) => ({ ...d, value: Math.round(d.value * 100) }));

  return (
    <div>
      <ChartContainer config={chartConfig} className="h-56 w-full">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 28, left: 4, bottom: 4 }}
          barSize={22}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tickLine={false}
            axisLine={false}
          />
          <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={72} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value) => [`${value}%`, "Share of Voice"]}
              />
            }
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {rows.map((d) => (
              <Cell key={d.label} fill={d.highlighted ? "var(--primary)" : "var(--muted-foreground)"} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              className="fill-foreground"
              formatter={(value: string | number | boolean | null | undefined) => `${value}%`}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: "var(--primary)" }} />
          {legend.highlighted}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: "var(--muted-foreground)" }} />
          {legend.rest}
        </span>
      </div>
    </div>
  );
}

/** Per-brand Share of Voice within one audit, the highlighted brand vs. its competitors. */
export function AeoShareOfVoiceChart({
  perBrand,
  myBrand,
}: {
  perBrand: BrandMetrics[];
  myBrand: string;
}) {
  return (
    <AeoEmphasisBarChart
      data={perBrand.map((b) => ({
        label: b.brand,
        value: b.shareOfVoice,
        highlighted: b.brand === myBrand,
      }))}
      legend={{ highlighted: `${myBrand} (you)`, rest: "Competitors" }}
    />
  );
}
