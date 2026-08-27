import { describe, expect, it } from "vitest";
import {
  COMPARISON_AUDIENCE_TEMPLATES,
  COMPARISON_TEMPLATES,
  generateInferentialQuestions,
  PAIN_ONLY_AUDIENCE_TEMPLATES,
  PAIN_ONLY_TEMPLATES,
  PROBLEM_FRAMED_AUDIENCE_TEMPLATES,
  PROBLEM_FRAMED_TEMPLATES,
} from "./inferentialTemplates";
import type { ProblemClaim } from "./types";

const claimWithAudience: ProblemClaim = {
  problem: "plan, track, and deliver work without a lot of overhead",
  audience: { orgTypes: [], userTypes: ["engineering teams"] },
  evidence: [{ url: "https://example.com/", snippet: "helps engineering teams plan..." }],
};

const claimWithoutAudience: ProblemClaim = {
  problem: "reduce noise and restore focus",
  audience: { orgTypes: [], userTypes: [] },
  evidence: [{ url: "https://example.com/other", snippet: "reduces noise..." }],
};

describe("generateInferentialQuestions", () => {
  it("without competitors: uses base + audience templates but not the named-comparison ones", () => {
    const questions = generateInferentialQuestions([claimWithAudience]);
    const expectedCount =
      PAIN_ONLY_TEMPLATES.length +
      PAIN_ONLY_AUDIENCE_TEMPLATES.length +
      PROBLEM_FRAMED_TEMPLATES.length +
      PROBLEM_FRAMED_AUDIENCE_TEMPLATES.length +
      COMPARISON_AUDIENCE_TEMPLATES.length;
    expect(questions).toHaveLength(expectedCount);
    expect(questions.some((q) => q.templateId.startsWith("comparison-named"))).toBe(false);
  });

  it("without an audience signal: skips every audience-requiring template", () => {
    const questions = generateInferentialQuestions([claimWithoutAudience]);
    const expectedCount =
      PAIN_ONLY_TEMPLATES.length + PROBLEM_FRAMED_TEMPLATES.length + COMPARISON_TEMPLATES.length;
    expect(questions).toHaveLength(expectedCount);
    expect(questions.every((q) => q.audience.length === 0)).toBe(true);
  });

  it("with >=2 competitors: adds the named-comparison templates", () => {
    const questions = generateInferentialQuestions([claimWithAudience], ["Jira", "Asana"]);
    expect(questions.some((q) => q.templateId === "comparison-named-audience")).toBe(true);
    const q = questions.find((question) => question.templateId === "comparison-named-audience");
    expect(q?.text).toBe(
      "Between Jira and Asana, which is better for engineering teams that need to plan, track, and deliver work without a lot of overhead?"
    );
  });

  it("with only 1 competitor: does not generate named-comparison templates", () => {
    const questions = generateInferentialQuestions([claimWithAudience], ["Jira"]);
    expect(questions.some((q) => q.templateId.startsWith("comparison-named"))).toBe(false);
  });

  it("covers all three awareness stages", () => {
    const questions = generateInferentialQuestions([claimWithAudience], ["Jira", "Asana"]);
    const stages = new Set(questions.map((q) => q.stage));
    expect(stages).toEqual(new Set(["pain_only", "problem_framed", "comparing_with_criteria"]));
  });

  it("pain-only questions never ask for a recommendation", () => {
    const questions = generateInferentialQuestions([claimWithAudience]).filter(
      (q) => q.stage === "pain_only"
    );
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.text.toLowerCase()).not.toMatch(/what (tool|should)|recommend/);
    }
  });

  it("never leaves an unfilled placeholder", () => {
    const questions = generateInferentialQuestions(
      [claimWithAudience, claimWithoutAudience],
      ["Jira", "Asana"]
    );
    for (const q of questions) {
      expect(q.text).not.toMatch(/\{(problem|audience|persona|competitorA|competitorB)\}/);
    }
  });

  it("never quotes the problem in quotation marks", () => {
    const questions = generateInferentialQuestions([claimWithAudience, claimWithoutAudience]);
    expect(questions.every((q) => !q.text.includes('"'))).toBe(true);
  });

  it("carries evidence URLs and audience list through to the output", () => {
    const questions = generateInferentialQuestions([claimWithAudience]);
    expect(questions[0].evidenceUrls).toEqual(["https://example.com/"]);
    expect(questions[0].audience).toEqual(["engineering teams"]);
  });

  it("assigns unique ids", () => {
    const questions = generateInferentialQuestions(
      [claimWithAudience, claimWithoutAudience],
      ["Jira", "Asana"]
    );
    const ids = new Set(questions.map((q) => q.id));
    expect(ids.size).toBe(questions.length);
  });
});
