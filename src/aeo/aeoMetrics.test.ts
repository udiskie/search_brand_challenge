import { describe, expect, it } from "vitest";
import { computeAeoMetrics } from "./aeoMetrics";
import type { ParsedRun, PromptDimensions } from "./types";

function dims(overrides: Partial<PromptDimensions> = {}): PromptDimensions {
  return {
    intent: "discovery",
    persona: { role: "founder", teamSize: "solo" },
    specificity: "generic",
    attribute: "none",
    language: "en",
    brandsNamed: [],
    ...overrides,
  };
}

const runs: ParsedRun[] = [
  {
    runId: "r1",
    promptId: "p1",
    dimensions: dims({ intent: "discovery" }),
    mentions: [
      { brand: "Linear", position: 1, role: "recommended_first", sentiment: "positive", context: "" },
      { brand: "Jira", position: 2, role: "mentioned", sentiment: "neutral", context: "" },
    ],
  },
  {
    runId: "r2",
    promptId: "p1",
    dimensions: dims({ intent: "discovery", language: "es" }),
    mentions: [
      { brand: "Linear", position: 1, role: "recommended_first", sentiment: "positive", context: "" },
    ],
  },
  {
    runId: "r3",
    promptId: "p2",
    dimensions: dims({ intent: "direct_comparison" }),
    mentions: [
      { brand: "Jira", position: 1, role: "recommended_first", sentiment: "negative", context: "" },
      { brand: "Linear", position: 2, role: "compared", sentiment: "neutral", context: "" },
    ],
  },
  {
    runId: "r4",
    promptId: "p2",
    dimensions: dims({ intent: "direct_comparison" }),
    mentions: [],
  },
];

describe("computeAeoMetrics", () => {
  const metrics = computeAeoMetrics(runs, "Linear", ["Jira"]);
  const linear = metrics.perBrand.find((b) => b.brand === "Linear")!;
  const jira = metrics.perBrand.find((b) => b.brand === "Jira")!;

  it("computes share of voice per brand", () => {
    expect(linear.shareOfVoice).toBeCloseTo(0.75);
    expect(jira.shareOfVoice).toBeCloseTo(0.5);
  });

  it("computes relative share of voice against the other brand(s)", () => {
    expect(linear.relativeShareOfVoice).toBeCloseTo(1.5);
    expect(jira.relativeShareOfVoice).toBeCloseTo(0.5 / 0.75);
  });

  it("computes average mention position", () => {
    expect(linear.averagePosition).toBeCloseTo((1 + 1 + 2) / 3);
    expect(jira.averagePosition).toBeCloseTo((2 + 1) / 2);
  });

  it("computes first-mention rate", () => {
    expect(linear.firstMentionRate).toBeCloseTo(2 / 4);
    expect(jira.firstMentionRate).toBeCloseTo(1 / 4);
  });

  it("computes sentiment score as the mean of +1/0/-1", () => {
    expect(linear.sentimentScore).toBeCloseTo((1 + 1 + 0) / 3);
    expect(jira.sentimentScore).toBeCloseTo((0 + -1) / 2);
  });

  it("computes mention counts", () => {
    expect(linear.mentionCount).toBe(3);
    expect(jira.mentionCount).toBe(2);
  });

  it("computes the co-occurrence matrix symmetrically", () => {
    const linearCo = metrics.coOccurrence.find((c) => c.brand === "Linear")!;
    const jiraCo = metrics.coOccurrence.find((c) => c.brand === "Jira")!;
    expect(linearCo.coOccursWith).toEqual([{ brand: "Jira", count: 2 }]);
    expect(jiraCo.coOccursWith).toEqual([{ brand: "Linear", count: 2 }]);
  });

  it("breaks share of voice down by prompt intent", () => {
    const discoveryLinear = metrics.byDimension.find(
      (e) => e.dimension === "intent" && e.value === "discovery" && e.brand === "Linear"
    )!;
    const discoveryJira = metrics.byDimension.find(
      (e) => e.dimension === "intent" && e.value === "discovery" && e.brand === "Jira"
    )!;
    expect(discoveryLinear.shareOfVoice).toBeCloseTo(1);
    expect(discoveryLinear.runCount).toBe(2);
    expect(discoveryJira.shareOfVoice).toBeCloseTo(0.5);

    const comparisonLinear = metrics.byDimension.find(
      (e) => e.dimension === "intent" && e.value === "direct_comparison" && e.brand === "Linear"
    )!;
    expect(comparisonLinear.shareOfVoice).toBeCloseTo(0.5);
  });

  it("handles an empty run set without dividing by zero", () => {
    const empty = computeAeoMetrics([], "Linear", ["Jira"]);
    expect(empty.perBrand.every((b) => b.shareOfVoice === 0)).toBe(true);
    expect(empty.perBrand.every((b) => b.averagePosition === null)).toBe(true);
  });
});
