import { describe, expect, it } from "vitest";
import { computeBrandGroundedMetrics } from "./brandGroundedMetrics";
import type { BrandGroundedParsedRun } from "./types";

const runs: BrandGroundedParsedRun[] = [
  {
    runId: "r1",
    promptId: "p1",
    source: "hook",
    mentions: [
      { brand: "Linear", position: 1, role: "recommended_first", sentiment: "positive", context: "" },
    ],
  },
  {
    runId: "r2",
    promptId: "p2",
    source: "inferential",
    stage: "pain_only",
    mentions: [],
  },
  {
    runId: "r3",
    promptId: "p3",
    source: "inferential",
    stage: "comparing_with_criteria",
    mentions: [
      { brand: "Linear", position: 1, role: "recommended_first", sentiment: "positive", context: "" },
      { brand: "Jira", position: 2, role: "compared", sentiment: "neutral", context: "" },
    ],
  },
];

describe("computeBrandGroundedMetrics", () => {
  const metrics = computeBrandGroundedMetrics(runs, "Linear", ["Jira"]);

  it("computes per-brand SoV using the same math as the neutral pipeline", () => {
    const linear = metrics.perBrand.find((b) => b.brand === "Linear")!;
    const jira = metrics.perBrand.find((b) => b.brand === "Jira")!;
    expect(linear.shareOfVoice).toBeCloseTo(2 / 3);
    expect(jira.shareOfVoice).toBeCloseTo(1 / 3);
  });

  it("breaks share of voice down by source (hook vs inferential)", () => {
    const hookLinear = metrics.byDimension.find(
      (e) => e.dimension === "source" && e.value === "hook" && e.brand === "Linear"
    )!;
    const inferentialLinear = metrics.byDimension.find(
      (e) => e.dimension === "source" && e.value === "inferential" && e.brand === "Linear"
    )!;
    expect(hookLinear.shareOfVoice).toBeCloseTo(1);
    expect(hookLinear.runCount).toBe(1);
    expect(inferentialLinear.shareOfVoice).toBeCloseTo(0.5); // 1 of 2 inferential runs
    expect(inferentialLinear.runCount).toBe(2);
  });

  it("breaks share of voice down by awareness stage (inferential runs only)", () => {
    const painOnly = metrics.byDimension.find(
      (e) => e.dimension === "stage" && e.value === "pain_only" && e.brand === "Linear"
    )!;
    const comparing = metrics.byDimension.find(
      (e) => e.dimension === "stage" && e.value === "comparing_with_criteria" && e.brand === "Linear"
    )!;
    expect(painOnly.shareOfVoice).toBe(0);
    expect(comparing.shareOfVoice).toBe(1);
  });

  it("does not produce a 'stage' entry for the hook source (no stage on those runs)", () => {
    const hookHasNoStageBreakdown = metrics.byDimension.some(
      (e) => e.dimension === "stage" && e.runCount === 1 && e.value === undefined
    );
    expect(hookHasNoStageBreakdown).toBe(false);
  });

  it("computes co-occurrence using the same logic as the neutral pipeline", () => {
    const linearCo = metrics.coOccurrence.find((c) => c.brand === "Linear")!;
    expect(linearCo.coOccursWith).toEqual([{ brand: "Jira", count: 1 }]);
  });

  it("reports totalRuns as all brand-grounded runs, including empty-mention ones", () => {
    expect(metrics.totalRuns).toBe(3);
  });
});
