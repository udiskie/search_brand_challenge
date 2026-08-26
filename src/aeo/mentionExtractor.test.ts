import { describe, expect, it } from "vitest";
import { extractMentions, parseRun } from "./mentionExtractor";
import type { GeminiRunResult } from "./types";

describe("extractMentions", () => {
  it("orders mentions by first occurrence in the text", () => {
    const text = "For project management, I'd suggest Asana first, then Linear, then Jira.";
    const mentions = extractMentions(text, ["Linear", "Jira", "Asana"]);
    expect(mentions.map((m) => m.brand)).toEqual(["Asana", "Linear", "Jira"]);
    expect(mentions.map((m) => m.position)).toEqual([1, 2, 3]);
  });

  it("marks the first mentioned brand as recommended_first", () => {
    const text = "Linear is the best tool for engineering teams.";
    const [mention] = extractMentions(text, ["Linear"]);
    expect(mention.role).toBe("recommended_first");
    expect(mention.sentiment).toBe("positive");
  });

  it("classifies a comparison context", () => {
    const text = "Linear vs Jira: Linear is faster for issue creation.";
    const mentions = extractMentions(text, ["Linear", "Jira"]);
    const jira = mentions.find((m) => m.brand === "Jira")!;
    expect(jira.role).toBe("compared");
  });

  it("classifies a discarded/negative mention", () => {
    const text = "I would not recommend Jira, it feels slow and complicated.";
    const [mention] = extractMentions(text, ["Jira"]);
    expect(mention.role).toBe("discarded");
    expect(mention.sentiment).toBe("negative");
  });

  it("returns an empty array when no brand is mentioned", () => {
    expect(extractMentions("Just use a spreadsheet.", ["Linear", "Jira"])).toEqual([]);
  });

  it("does not double count repeated mentions of the same brand", () => {
    const text = "Linear is great. Linear is also fast.";
    const mentions = extractMentions(text, ["Linear"]);
    expect(mentions).toHaveLength(1);
  });
});

describe("parseRun", () => {
  const baseRun: GeminiRunResult = {
    runId: "run-1",
    promptId: "discovery-0",
    promptText: "What PM tools exist?",
    dimensions: {
      intent: "discovery",
      persona: { role: "founder", teamSize: "solo" },
      specificity: "generic",
      attribute: "none",
      language: "en",
      brandsNamed: [],
    },
    temperature: 0.9,
    timestamp: new Date().toISOString(),
    finishReason: "STOP",
    rawText: "Linear and Jira are both popular options.",
  };

  it("extracts mentions from the run's raw text", () => {
    const parsed = parseRun(baseRun, ["Linear", "Jira"]);
    expect(parsed.mentions.map((m) => m.brand)).toEqual(["Linear", "Jira"]);
    expect(parsed.runId).toBe("run-1");
  });

  it("returns no mentions when rawText is null (a failed call)", () => {
    const parsed = parseRun({ ...baseRun, rawText: null }, ["Linear", "Jira"]);
    expect(parsed.mentions).toEqual([]);
  });
});
