import { describe, expect, it } from "vitest";
import type { TagcloudTerm } from "../scraper/types";
import { clusterTermsByTaxonomy } from "./clusterTerms";

function term(term: string, score: number, documentFrequency = 1): TagcloudTerm {
  return { term, score, documentFrequency, occurrences: documentFrequency };
}

describe("clusterTermsByTaxonomy", () => {
  it("buckets terms into their matching theme", () => {
    const { themes } = clusterTermsByTaxonomy([
      term("agent", 10),
      term("agents", 8),
      term("team", 6),
      term("issues", 5),
    ]);

    const aiTheme = themes.find((t) => t.name === "AI & Automation");
    const collabTheme = themes.find((t) => t.name === "Collaboration & Teams");
    const trackingTheme = themes.find((t) => t.name === "Issue & Project Tracking");

    expect(aiTheme?.terms.map((t) => t.term).sort()).toEqual(["agent", "agents"]);
    expect(collabTheme?.terms.map((t) => t.term)).toEqual(["team"]);
    expect(trackingTheme?.terms.map((t) => t.term)).toEqual(["issues"]);
  });

  it("puts terms matching no theme into unclustered", () => {
    const { unclustered } = clusterTermsByTaxonomy([term("banana", 3)]);
    expect(unclustered.map((t) => t.term)).toEqual(["banana"]);
  });

  it("drops known scrape artifacts outright", () => {
    const { themes, unclustered } = clusterTermsByTaxonomy([term("contextreply", 99)]);
    expect(themes.flatMap((t) => t.terms)).toHaveLength(0);
    expect(unclustered).toHaveLength(0);
  });

  it("sorts themes by total term score descending", () => {
    const { themes } = clusterTermsByTaxonomy([
      term("team", 5),
      term("agent", 50),
    ]);
    expect(themes[0].name).toBe("AI & Automation");
  });

  it("initializes questions and answer stats empty, ready for correlation", () => {
    const { themes } = clusterTermsByTaxonomy([term("team", 5)]);
    expect(themes[0].questions).toEqual([]);
    expect(themes[0].neutralAnswers).toEqual({
      runsScanned: 0,
      runsMentioning: 0,
      sampleContexts: [],
    });
  });
});
