import { describe, expect, it } from "vitest";
import { generatePrompts } from "./promptGenerator";
import type { AeoAuditConfig } from "./types";

const baseConfig: AeoAuditConfig = {
  brand: "Linear",
  competitors: ["Jira", "Asana", "Monday", "Notion"],
  category: "project management",
  promptCount: 20,
  runsPerPrompt: 5,
  temperature: 0.9,
  model: "gemini-2.0-flash",
};

describe("generatePrompts", () => {
  it("generates the requested number of prompts", () => {
    const prompts = generatePrompts(baseConfig);
    expect(prompts).toHaveLength(20);
  });

  it("reserves an adversarial/control quota that never names the category", () => {
    const prompts = generatePrompts(baseConfig);
    const adversarial = prompts.filter((p) => p.dimensions.intent === "adversarial_control");
    expect(adversarial.length).toBeGreaterThanOrEqual(2);
    for (const prompt of adversarial) {
      expect(prompt.text.toLowerCase()).not.toContain("project management");
      expect(prompt.dimensions.brandsNamed).toEqual([]);
    }
  });

  it("names exactly two brands in direct-comparison prompts, including our own", () => {
    const prompts = generatePrompts(baseConfig);
    const comparisons = prompts.filter((p) => p.dimensions.intent === "direct_comparison");
    expect(comparisons.length).toBeGreaterThan(0);
    for (const prompt of comparisons) {
      expect(prompt.dimensions.brandsNamed).toContain("Linear");
      expect(prompt.dimensions.brandsNamed).toHaveLength(2);
      expect(prompt.text).toContain("Linear");
    }
  });

  it("names three brands in final-decision prompts", () => {
    const prompts = generatePrompts(baseConfig);
    const finalDecisions = prompts.filter((p) => p.dimensions.intent === "final_decision");
    for (const prompt of finalDecisions) {
      expect(prompt.dimensions.brandsNamed).toHaveLength(3);
    }
  });

  it("produces both English and Spanish prompts", () => {
    const prompts = generatePrompts(baseConfig);
    const languages = new Set(prompts.map((p) => p.dimensions.language));
    expect(languages.has("en")).toBe(true);
    expect(languages.has("es")).toBe(true);
  });

  it("assigns unique ids", () => {
    const prompts = generatePrompts(baseConfig);
    const ids = new Set(prompts.map((p) => p.id));
    expect(ids.size).toBe(prompts.length);
  });

  it("is deterministic across runs with the same config", () => {
    const first = generatePrompts(baseConfig);
    const second = generatePrompts(baseConfig);
    expect(first).toEqual(second);
  });
});
