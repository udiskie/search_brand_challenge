import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aeoDir, extractedDir, productDir, writeJson } from "../scraper/datalake";
import { runTermClustering } from "./run";

describe("runTermClustering", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(path.join(tmpdir(), "clustering-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws a clear error when tagcloud.json is missing", async () => {
    await expect(runTermClustering("linear", "taxonomy")).rejects.toThrow(/Missing tagcloud.json/);
  });

  it("rejects llm method without a geminiConfig", async () => {
    await writeJson(path.join(extractedDir("linear"), "tagcloud.json"), { site: [], byPage: {} });
    await expect(runTermClustering("linear", "llm")).rejects.toThrow(/requires a Gemini API key/);
  });

  it("clusters, correlates against questions and answers, and writes the output file", async () => {
    await writeJson(path.join(extractedDir("linear"), "tagcloud.json"), {
      site: [
        { term: "agent", score: 10, documentFrequency: 3 },
        { term: "banana", score: 2, documentFrequency: 1 },
      ],
      byPage: {},
    });
    await writeJson(path.join(productDir("linear"), "questions", "candidate_user_questions.json"), {
      hooks: [],
      hookQuestions: [
        {
          id: "hook-0",
          text: "What is the best AI agent for issue tracking?",
          templateId: "t1",
          hook: "agent",
          hookSource: "tagcloud",
          evidenceUrls: [],
        },
      ],
      claims: [],
      inferentialQuestions: [],
    });
    await writeJson(path.join(aeoDir("linear"), "runs", "run-1.json"), {
      runId: "run-1",
      promptId: "p1",
      promptText: "test",
      dimensions: {
        intent: "discovery",
        persona: { role: "founder", teamSize: "1-10" },
        specificity: "generic",
        attribute: "none",
        language: "en",
        brandsNamed: [],
      },
      temperature: 0.9,
      timestamp: new Date().toISOString(),
      finishReason: "STOP",
      rawText: "Linear's AI agent automates issue triage well.",
    });

    const result = await runTermClustering("linear", "taxonomy");

    expect(result.product).toBe("linear");
    expect(result.method).toBe("taxonomy");
    expect(result.unclustered.map((t) => t.term)).toEqual(["banana"]);

    const aiTheme = result.themes.find((t) => t.name === "AI & Automation");
    expect(aiTheme?.terms.map((t) => t.term)).toEqual(["agent"]);
    expect(aiTheme?.questions).toEqual([
      { id: "hook-0", text: "What is the best AI agent for issue tracking?", kind: "hook" },
    ]);
    expect(aiTheme?.neutralAnswers.runsMentioning).toBe(1);
    expect(aiTheme?.brandGroundedAnswers.runsMentioning).toBe(0);

    const written = JSON.parse(
      readFileSync(
        path.join(tmpDir, "datalake", "linear", "clusters", "theme_clusters.taxonomy.json"),
        "utf-8"
      )
    );
    expect(written.method).toBe("taxonomy");
  });

  it("runs the llm method end to end and writes a sibling output file", async () => {
    await writeJson(path.join(extractedDir("linear"), "tagcloud.json"), {
      site: [{ term: "agent", score: 10, documentFrequency: 3 }],
      byPage: {},
    });

    const geminiFetch = (async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      themes: [{ name: "AI & Automation", terms: ["agent"] }],
                      unclustered: [],
                    }),
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        }),
        { status: 200 }
      )) as typeof fetch;

    const result = await runTermClustering(
      "linear",
      "llm",
      { geminiConfig: { apiKey: "test-key", model: "gemini-3.6-flash", timeoutMs: 1000, maxRetries: 1 } },
      geminiFetch
    );

    expect(result.method).toBe("llm");
    expect(result.themes[0].name).toBe("AI & Automation");

    const written = JSON.parse(
      readFileSync(
        path.join(tmpDir, "datalake", "linear", "clusters", "theme_clusters.llm.json"),
        "utf-8"
      )
    );
    expect(written.method).toBe("llm");
  });
});
