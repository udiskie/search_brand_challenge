import { describe, expect, it } from "vitest";
import {
  AUDIENCE_TEMPLATES,
  generateInferentialQuestions,
  UNIVERSAL_TEMPLATES,
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
  it("uses both universal and audience templates when an audience was detected", () => {
    const questions = generateInferentialQuestions([claimWithAudience]);
    expect(questions).toHaveLength(UNIVERSAL_TEMPLATES.length + AUDIENCE_TEMPLATES.length);
  });

  it("uses only universal templates when no audience was detected", () => {
    const questions = generateInferentialQuestions([claimWithoutAudience]);
    expect(questions).toHaveLength(UNIVERSAL_TEMPLATES.length);
    expect(questions.every((q) => !q.text.includes("{audience}"))).toBe(true);
  });

  it("never leaves an unfilled {audience} placeholder for an audience-less claim", () => {
    const questions = generateInferentialQuestions([claimWithoutAudience]);
    for (const q of questions) {
      expect(q.text).not.toContain("{audience}");
      expect(q.text).not.toContain("{problem}");
    }
  });

  it("fills the audience template naturally with the detected audience phrase", () => {
    const questions = generateInferentialQuestions([claimWithAudience]);
    const q = questions.find((question) => question.templateId === "problem-for-audience");
    expect(q?.text).toBe(
      "What tool would you recommend for engineering teams that need to plan, track, and deliver work without a lot of overhead?"
    );
  });

  it("never quotes the problem in quotation marks (paraphrased need, not a citation)", () => {
    const questions = generateInferentialQuestions([claimWithAudience, claimWithoutAudience]);
    expect(questions.every((q) => !q.text.includes('"'))).toBe(true);
  });

  it("carries evidence URLs and audience list through to the output", () => {
    const questions = generateInferentialQuestions([claimWithAudience]);
    expect(questions[0].evidenceUrls).toEqual(["https://example.com/"]);
    expect(questions[0].audience).toEqual(["engineering teams"]);
  });
});
