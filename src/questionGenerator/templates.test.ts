import { describe, expect, it } from "vitest";
import { generateCandidateQuestions, QUESTION_TEMPLATES } from "./templates";
import type { ProductHook } from "./types";

const hooks: ProductHook[] = [
  {
    hook: "keyboard-first workflow",
    source: "tagcloud",
    documentFrequency: 3,
    evidence: [{ url: "https://example.com/", snippet: "keyboard-first workflow" }],
  },
  {
    hook: "Example is a project tracker for engineering teams.",
    source: "meta_description",
    documentFrequency: 1,
    evidence: [{ url: "https://example.com/", snippet: "Example is a project tracker." }],
  },
];

describe("generateCandidateQuestions", () => {
  const questions = generateCandidateQuestions(hooks);

  it("generates one question per hook per template", () => {
    expect(questions).toHaveLength(hooks.length * QUESTION_TEMPLATES.length);
  });

  it("fills the {hook} placeholder into the question text", () => {
    const q = questions.find((question) => question.templateId === "direct-differentiator");
    expect(q?.text).toContain("keyboard-first workflow");
    expect(q?.text).not.toContain("{hook}");
  });

  it("fills the {persona} placeholder for persona-specific templates", () => {
    const q = questions.find((question) => question.templateId === "persona-specific");
    expect(q?.text).not.toContain("{persona}");
    expect(q?.text).toMatch(/As (an|a) /);
  });

  it("carries evidence URLs through from the originating hook", () => {
    const q = questions.find((question) => question.hook === "keyboard-first workflow");
    expect(q?.evidenceUrls).toEqual(["https://example.com/"]);
  });

  it("assigns unique ids", () => {
    const ids = new Set(questions.map((q) => q.id));
    expect(ids.size).toBe(questions.length);
  });
});
