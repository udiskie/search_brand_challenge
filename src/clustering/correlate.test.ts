import { describe, expect, it } from "vitest";
import type { CandidateQuestion, InferentialQuestion } from "../questionGenerator/types";
import { correlateAnswers, correlateQuestions } from "./correlate";
import type { Theme } from "./types";

function baseTheme(name: string, terms: string[]): Theme {
  return {
    name,
    terms: terms.map((term) => ({ term, score: 1, documentFrequency: 1 })),
    questions: [],
    neutralAnswers: { runsScanned: 0, runsMentioning: 0, sampleContexts: [] },
    brandGroundedAnswers: { runsScanned: 0, runsMentioning: 0, sampleContexts: [] },
  };
}

describe("correlateQuestions", () => {
  const hookQuestion: CandidateQuestion = {
    id: "hook-0",
    text: "What is the best tool for agent automation?",
    templateId: "t1",
    hook: "agent automation",
    hookSource: "tagcloud",
    evidenceUrls: [],
  };

  const inferentialQuestion: InferentialQuestion = {
    id: "inf-0",
    text: "How do I get my team to collaborate better?",
    templateId: "t2",
    stage: "pain_only",
    problem: "collaborate better",
    audience: [],
    evidenceUrls: [],
  };

  it("attaches a question to every theme whose terms it mentions", () => {
    const themes = [baseTheme("AI & Automation", ["agent"]), baseTheme("Collaboration & Teams", ["team"])];
    const result = correlateQuestions(themes, {
      hookQuestions: [hookQuestion],
      inferentialQuestions: [inferentialQuestion],
    });

    expect(result[0].questions).toEqual([
      { id: "hook-0", text: hookQuestion.text, kind: "hook" },
    ]);
    expect(result[1].questions).toEqual([
      { id: "inf-0", text: inferentialQuestion.text, kind: "inferential" },
    ]);
  });

  it("is a no-op when candidateQuestions is undefined", () => {
    const themes = [baseTheme("AI & Automation", ["agent"])];
    expect(correlateQuestions(themes, undefined)).toBe(themes);
  });

  it("leaves a theme's questions empty when nothing matches", () => {
    const themes = [baseTheme("Pricing & Plans", ["free"])];
    const result = correlateQuestions(themes, {
      hookQuestions: [hookQuestion],
      inferentialQuestions: [],
    });
    expect(result[0].questions).toEqual([]);
  });
});

describe("correlateAnswers", () => {
  it("counts only runs whose text mentions a theme term", () => {
    const themes = [baseTheme("AI & Automation", ["agent"])];
    const runs = [
      { rawText: "Our AI agent handles this automatically." },
      { rawText: "This tool has no relevant features." },
      { rawText: null },
    ];

    const result = correlateAnswers(themes, runs, "neutralAnswers");

    expect(result[0].neutralAnswers.runsScanned).toBe(2);
    expect(result[0].neutralAnswers.runsMentioning).toBe(1);
    expect(result[0].neutralAnswers.sampleContexts).toHaveLength(1);
    expect(result[0].neutralAnswers.sampleContexts[0]).toContain("agent");
  });

  it("caps sample contexts at 3 even with more matching runs", () => {
    const themes = [baseTheme("AI & Automation", ["agent"])];
    const runs = Array.from({ length: 5 }, () => ({ rawText: "an agent helps here" }));

    const result = correlateAnswers(themes, runs, "neutralAnswers");

    expect(result[0].neutralAnswers.runsMentioning).toBe(5);
    expect(result[0].neutralAnswers.sampleContexts).toHaveLength(3);
  });

  it("fills the requested field only, leaving the other untouched", () => {
    const themes = [baseTheme("AI & Automation", ["agent"])];
    const result = correlateAnswers(themes, [{ rawText: "an agent" }], "brandGroundedAnswers");

    expect(result[0].brandGroundedAnswers.runsMentioning).toBe(1);
    expect(result[0].neutralAnswers.runsMentioning).toBe(0);
  });
});
