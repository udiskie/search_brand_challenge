"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { TagcloudTerm } from "@/scraper/types";

const chartConfig = {
  occurrences: {
    label: "Occurrences",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

export function TagcloudBarChart({ terms }: { terms: TagcloudTerm[] }) {
  if (terms.length === 0) return null;

  const data = terms.map((t) => ({ term: t.term, occurrences: t.occurrences }));

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="term"
          tickLine={false}
          axisLine={false}
          angle={-45}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="occurrences" fill="var(--color-occurrences)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
