import { describe, expect, it } from "vitest";
import { buildPhraseCloud } from "./phraseCloud";

describe("buildPhraseCloud", () => {
  const pages = [
    {
      url: "https://linear.app/",
      text: "Linear is built for speed. Teams love the keyboard-first workflow.",
    },
    {
      url: "https://linear.app/pricing",
      text: "Pricing starts free. Linear scales with your team.",
    },
  ];

  it("collects sentences containing the term across pages", () => {
    const [entry] = buildPhraseCloud(pages, [
      { term: "linear", score: 1, documentFrequency: 2, occurrences: 2 },
    ]);
    expect(entry.term).toBe("linear");
    expect(entry.occurrences).toHaveLength(2);
    expect(entry.occurrences[0].url).toBe("https://linear.app/");
    expect(entry.occurrences[0].snippet).toContain("Linear");
  });

  it("does not match substrings of other words", () => {
    const [entry] = buildPhraseCloud(pages, [
      { term: "team", score: 1, documentFrequency: 1, occurrences: 1 },
    ]);
    // "team" must not match "Teams" (word-boundary match only)
    expect(entry.occurrences).toHaveLength(1);
    expect(entry.occurrences[0].snippet).toContain("your team");
  });

  it("caps the number of snippets per term", () => {
    const manyPages = Array.from({ length: 10 }, (_, i) => ({
      url: `https://example.com/${i}`,
      text: "Linear is great. Linear is fast.",
    }));
    const [entry] = buildPhraseCloud(
      manyPages,
      [{ term: "linear", score: 1, documentFrequency: 10, occurrences: 10 }],
      3
    );
    expect(entry.occurrences).toHaveLength(3);
  });
});
