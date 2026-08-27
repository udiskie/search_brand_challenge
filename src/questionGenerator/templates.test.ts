import { describe, expect, it } from "vitest";
import {
  generateCandidateQuestions,
  LONG_FORM_TEMPLATES,
  SHORT_PHRASE_TEMPLATES,
} from "./templates";
import type { ProductHook } from "./types";

const shortHook: ProductHook = {
  hook: "keyboard-first workflow",
  source: "tagcloud",
  documentFrequency: 3,
  evidence: [{ url: "https://example.com/", snippet: "keyboard-first workflow" }],
};

const longHook: ProductHook = {
  hook: "Example is a project tracker built for engineering teams who care about speed.",
  source: "meta_description",
  documentFrequency: 1,
  evidence: [{ url: "https://example.com/", snippet: "Example is a project tracker." }],
};

describe("generateCandidateQuestions", () => {
  it("uses short-phrase templates for a short hook and long-form templates for a sentence-length hook", () => {
    const questions = generateCandidateQuestions([shortHook, longHook]);
    expect(questions.filter((q) => q.hook === shortHook.hook)).toHaveLength(
      SHORT_PHRASE_TEMPLATES.length
    );
    expect(questions.filter((q) => q.hook === longHook.hook)).toHaveLength(
      LONG_FORM_TEMPLATES.length
    );
  });

  it("fills the {hook} placeholder into the question text", () => {
    const questions = generateCandidateQuestions([shortHook]);
    const q = questions.find((question) => question.templateId === "direct-differentiator");
    expect(q?.text).toContain("keyboard-first workflow");
    expect(q?.text).not.toContain("{hook}");
  });

  it("quotes a long-form hook whole rather than splicing it into a short template", () => {
    const questions = generateCandidateQuestions([longHook]);
    const q = questions.find((question) => question.templateId === "long-form-quote-match");
    expect(q?.text).toBe(
      'What tool matches this description: "Example is a project tracker built for engineering teams who care about speed."?'
    );
  });

  it("fills the {persona} placeholder for persona-aware templates", () => {
    const questions = generateCandidateQuestions([shortHook, longHook]);
    const q = questions.find((question) => question.templateId === "persona-specific");
    expect(q?.text).not.toContain("{persona}");
    expect(q?.text).toMatch(/As (an|a) /);
  });

  it("carries evidence URLs through from the originating hook", () => {
    const questions = generateCandidateQuestions([shortHook]);
    const q = questions.find((question) => question.hook === shortHook.hook);
    expect(q?.evidenceUrls).toEqual(["https://example.com/"]);
  });

  it("assigns unique ids", () => {
    const questions = generateCandidateQuestions([shortHook, longHook]);
    const ids = new Set(questions.map((q) => q.id));
    expect(ids.size).toBe(questions.length);
  });
});
