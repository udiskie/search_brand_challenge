import { describe, expect, it } from "vitest";
import type { TagcloudTerm } from "../scraper/types";
import { clusterTermsByLlm } from "./clusterTermsByLlm";

const baseConfig = {
  apiKey: "test-key",
  model: "gemini-3.6-flash",
  timeoutMs: 1000,
  maxRetries: 1,
};

function term(term: string, score: number, documentFrequency = 1): TagcloudTerm {
  return { term, score, documentFrequency };
}

function geminiFetch(text: string): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] }),
      { status: 200 }
    )) as typeof fetch;
}

describe("clusterTermsByLlm", () => {
  it("builds themes from a well-formed JSON response", async () => {
    const response = JSON.stringify({
      themes: [{ name: "AI & Automation", terms: ["agent", "agents"] }],
      unclustered: ["banana"],
    });

    const { themes, unclustered } = await clusterTermsByLlm(
      [term("agent", 10), term("agents", 8), term("banana", 3)],
      baseConfig,
      geminiFetch(response)
    );

    expect(themes).toEqual([
      {
        name: "AI & Automation",
        terms: [
          { term: "agent", score: 10, documentFrequency: 1 },
          { term: "agents", score: 8, documentFrequency: 1 },
        ],
        questions: [],
        neutralAnswers: { runsScanned: 0, runsMentioning: 0, sampleContexts: [] },
        brandGroundedAnswers: { runsScanned: 0, runsMentioning: 0, sampleContexts: [] },
      },
    ]);
    expect(unclustered.map((t) => t.term)).toEqual(["banana"]);
  });

  it("strips a markdown code fence around the JSON", async () => {
    const response = "```json\n" + JSON.stringify({
      themes: [{ name: "AI & Automation", terms: ["agent"] }],
      unclustered: [],
    }) + "\n```";

    const { themes } = await clusterTermsByLlm(
      [term("agent", 10)],
      baseConfig,
      geminiFetch(response)
    );

    expect(themes[0].name).toBe("AI & Automation");
  });

  it("drops an invented term not present in the original input", async () => {
    const response = JSON.stringify({
      themes: [{ name: "AI & Automation", terms: ["agent", "made-up-term"] }],
      unclustered: [],
    });

    const { themes } = await clusterTermsByLlm(
      [term("agent", 10)],
      baseConfig,
      geminiFetch(response)
    );

    expect(themes[0].terms.map((t) => t.term)).toEqual(["agent"]);
  });

  it("falls back to unclustered when the response isn't valid JSON", async () => {
    const { themes, unclustered } = await clusterTermsByLlm(
      [term("agent", 10)],
      baseConfig,
      geminiFetch("not json at all")
    );

    expect(themes).toEqual([]);
    expect(unclustered.map((t) => t.term)).toEqual(["agent"]);
  });

  it("falls back to unclustered when the response is malformed JSON shape", async () => {
    const { themes, unclustered } = await clusterTermsByLlm(
      [term("agent", 10)],
      baseConfig,
      geminiFetch(JSON.stringify({ foo: "bar" }))
    );

    expect(themes).toEqual([]);
    expect(unclustered.map((t) => t.term)).toEqual(["agent"]);
  });

  it("falls back to unclustered when Gemini returns no text", async () => {
    const fetchImpl = (async () => new Response("not found", { status: 404 })) as typeof fetch;

    const { themes, unclustered } = await clusterTermsByLlm(
      [term("agent", 10)],
      baseConfig,
      fetchImpl
    );

    expect(themes).toEqual([]);
    expect(unclustered.map((t) => t.term)).toEqual(["agent"]);
  });

  it("excludes known scrape artifacts from the candidate set entirely", async () => {
    const { unclustered } = await clusterTermsByLlm(
      [term("agent", 10), term("contextreply", 99)],
      baseConfig,
      geminiFetch(JSON.stringify({ themes: [], unclustered: ["agent"] }))
    );

    expect(unclustered.map((t) => t.term)).toEqual(["agent"]);
  });

  it("caps the candidate set at the top 50 terms by score", async () => {
    const manyTerms = Array.from({ length: 60 }, (_, i) => term(`term${i}`, 60 - i));
    const response = JSON.stringify({ themes: [], unclustered: manyTerms.slice(0, 50).map((t) => t.term) });

    const { unclustered } = await clusterTermsByLlm(manyTerms, baseConfig, geminiFetch(response));

    expect(unclustered).toHaveLength(50);
  });
});
