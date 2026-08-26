import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callGemini, runGeminiForPrompts } from "./geminiClient";
import type { GeneratedPrompt } from "./types";

const baseConfig = {
  apiKey: "test-key",
  model: "gemini-2.0-flash",
  temperature: 0.9,
  timeoutMs: 1000,
  maxRetries: 1,
  concurrency: 2,
  requestDelayMs: 0,
};

function geminiResponse(text: string, finishReason = "STOP") {
  return {
    candidates: [{ content: { parts: [{ text }] }, finishReason }],
  };
}

describe("callGemini", () => {
  it("returns the text and finishReason on success", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify(geminiResponse("Linear is great.")), {
        status: 200,
      })) as typeof fetch;

    const result = await callGemini("some prompt", baseConfig, fetchImpl);
    expect(result.text).toBe("Linear is great.");
    expect(result.finishReason).toBe("STOP");
    expect(result.error).toBeUndefined();
  });

  it("retries on 429 and eventually succeeds", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      if (calls === 1) return new Response("", { status: 429 });
      return new Response(JSON.stringify(geminiResponse("ok")), { status: 200 });
    }) as typeof fetch;

    const result = await callGemini("prompt", baseConfig, fetchImpl);
    expect(calls).toBe(2);
    expect(result.text).toBe("ok");
  });

  it("surfaces the API error message on a 4xx", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: { message: "invalid API key" } }), {
        status: 400,
      })) as typeof fetch;

    const result = await callGemini("prompt", baseConfig, fetchImpl);
    expect(result.text).toBeNull();
    expect(result.error).toBe("invalid API key");
  });
});

describe("runGeminiForPrompts", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(path.join(tmpdir(), "gemini-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("calls Gemini runsPerPrompt times per prompt and persists every raw run", async () => {
    const prompts: GeneratedPrompt[] = [
      {
        id: "discovery-0",
        text: "What PM tools exist?",
        dimensions: {
          intent: "discovery",
          persona: { role: "founder", teamSize: "solo" },
          specificity: "generic",
          attribute: "none",
          language: "en",
          brandsNamed: [],
        },
      },
    ];

    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(geminiResponse("Linear, Jira, Asana.")), {
          status: 200,
        })
    ) as typeof fetch;

    const results = await runGeminiForPrompts("linear", prompts, 3, baseConfig, fetchImpl);

    expect(results).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    const runFiles = readdirSync(
      path.join(tmpDir, "datalake", "linear", "aeo", "runs")
    );
    expect(runFiles).toHaveLength(3);
  });
});
