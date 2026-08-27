import { describe, expect, it } from "vitest";
import { findGeoAeoGaps } from "./crossValidate";
import type { ParsedRun, PromptDimensions } from "./types";

function dims(): PromptDimensions {
  return {
    intent: "discovery",
    persona: { role: "founder", teamSize: "solo" },
    specificity: "generic",
    attribute: "none",
    language: "en",
    brandsNamed: [],
  };
}

describe("findGeoAeoGaps", () => {
  const siteTagcloud = [
    { term: "keyboard", score: 10, documentFrequency: 2, occurrences: 4 },
    { term: "cycles", score: 8, documentFrequency: 1, occurrences: 1 },
    { term: "integrations", score: 5, documentFrequency: 3, occurrences: 6 },
  ];

  const runs: ParsedRun[] = [
    {
      runId: "r1",
      promptId: "p1",
      dimensions: dims(),
      mentions: [
        {
          brand: "Linear",
          position: 1,
          role: "recommended_first",
          sentiment: "positive",
          context: "Linear has a great keyboard-first workflow and is fast.",
        },
      ],
    },
  ];

  it("flags a top site term the model never uses when mentioning the brand", () => {
    const gaps = findGeoAeoGaps(siteTagcloud, runs, "Linear");
    const cycles = gaps.find((g) => g.term === "cycles")!;
    expect(cycles.mentionedByModel).toBe(false);
  });

  it("marks a term the model does use as covered", () => {
    const gaps = findGeoAeoGaps(siteTagcloud, runs, "Linear");
    const keyboard = gaps.find((g) => g.term === "keyboard")!;
    expect(keyboard.mentionedByModel).toBe(true);
  });

  it("ignores mentions of a different brand", () => {
    const gaps = findGeoAeoGaps(siteTagcloud, runs, "Jira");
    expect(gaps.every((g) => g.mentionedByModel === false)).toBe(true);
  });

  it("respects the topN cap", () => {
    const gaps = findGeoAeoGaps(siteTagcloud, runs, "Linear", 2);
    expect(gaps).toHaveLength(2);
  });
});
