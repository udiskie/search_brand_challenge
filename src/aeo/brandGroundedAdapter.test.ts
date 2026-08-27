import { describe, expect, it } from "vitest";
import { hookQuestionsToPrompts, inferentialQuestionsToPrompts } from "./brandGroundedAdapter";
import type { CandidateQuestion, InferentialQuestion } from "../questionGenerator/types";

describe("hookQuestionsToPrompts", () => {
  it("maps a candidate question to a hook-sourced prompt with no stage", () => {
    const questions: CandidateQuestion[] = [
      {
        id: "direct-differentiator-0",
        text: 'What tool would you recommend for a team that wants "speed"?',
        templateId: "direct-differentiator",
        hook: "speed",
        hookSource: "tagcloud",
        evidenceUrls: ["https://example.com/"],
      },
    ];

    const [prompt] = hookQuestionsToPrompts(questions);
    expect(prompt).toEqual({
      id: "direct-differentiator-0",
      text: 'What tool would you recommend for a team that wants "speed"?',
      source: "hook",
      templateId: "direct-differentiator",
    });
  });
});

describe("inferentialQuestionsToPrompts", () => {
  it("maps an inferential question to a prompt carrying its awareness stage", () => {
    const questions: InferentialQuestion[] = [
      {
        id: "pain-vent-0",
        text: "As an engineering lead, my team keeps struggling to ship fast.",
        templateId: "pain-vent",
        stage: "pain_only",
        problem: "ship fast",
        audience: [],
        evidenceUrls: ["https://example.com/"],
      },
    ];

    const [prompt] = inferentialQuestionsToPrompts(questions);
    expect(prompt).toEqual({
      id: "pain-vent-0",
      text: "As an engineering lead, my team keeps struggling to ship fast.",
      source: "inferential",
      templateId: "pain-vent",
      stage: "pain_only",
    });
  });
});
