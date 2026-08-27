import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseBrandGroundedRun, runGeminiForBrandGroundedPrompts } from "./brandGroundedRunner";
import type { BrandGroundedPrompt, BrandGroundedRunResult } from "./types";

const baseConfig = {
  apiKey: "test-key",
  model: "gemini-3.6-flash",
  temperature: 0.9,
  timeoutMs: 1000,
  maxRetries: 1,
  concurrency: 2,
  requestDelayMs: 0,
};

function geminiResponse(text: string) {
  return {
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  };
}

describe("runGeminiForBrandGroundedPrompts", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(path.join(tmpdir(), "brand-grounded-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("calls Gemini runsPerPrompt times per prompt and persists every raw run", async () => {
    const prompts: BrandGroundedPrompt[] = [
      {
        id: "pain-vent-0",
        text: "My team keeps struggling to ship fast.",
        source: "inferential",
        templateId: "pain-vent",
        stage: "pain_only",
      },
      {
        id: "direct-differentiator-0",
        text: 'What tool matches "keyboard-first workflow"?',
        source: "hook",
        templateId: "direct-differentiator",
      },
    ];

    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(geminiResponse("Linear is great for this.")), {
          status: 200,
        })
    ) as typeof fetch;

    const results = await runGeminiForBrandGroundedPrompts(
      "linear",
      prompts,
      2,
      baseConfig,
      fetchImpl
    );

    expect(results).toHaveLength(4); // 2 prompts x 2 runs
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(results.filter((r) => r.source === "hook")).toHaveLength(2);
    expect(results.filter((r) => r.source === "inferential")).toHaveLength(2);
    expect(results.find((r) => r.source === "inferential")?.stage).toBe("pain_only");
    expect(results.find((r) => r.source === "hook")?.stage).toBeUndefined();

    const runFiles = readdirSync(
      path.join(tmpDir, "datalake", "linear", "aeo", "brand_grounded_runs")
    );
    expect(runFiles).toHaveLength(4);
  });

  it("propagates a failed call's error rather than throwing", async () => {
    const prompts: BrandGroundedPrompt[] = [
      {
        id: "p1",
        text: "Some question",
        source: "hook",
        templateId: "direct-differentiator",
      },
    ];
    const fetchImpl = (async () => new Response("", { status: 500 })) as typeof fetch;

    const [result] = await runGeminiForBrandGroundedPrompts(
      "linear",
      prompts,
      1,
      { ...baseConfig, maxRetries: 0 },
      fetchImpl
    );

    expect(result.rawText).toBeNull();
    expect(result.error).toBeDefined();
  });
});

describe("parseBrandGroundedRun", () => {
  const baseRun: BrandGroundedRunResult = {
    runId: "run-1",
    promptId: "p1",
    promptText: "some question",
    source: "inferential",
    templateId: "pain-vent",
    stage: "pain_only",
    temperature: 0.9,
    timestamp: new Date().toISOString(),
    finishReason: "STOP",
    rawText: "Linear and Jira are both mentioned here.",
  };

  it("extracts mentions and carries source/stage through", () => {
    const parsed = parseBrandGroundedRun(baseRun, ["Linear", "Jira"]);
    expect(parsed.mentions.map((m) => m.brand)).toEqual(["Linear", "Jira"]);
    expect(parsed.source).toBe("inferential");
    expect(parsed.stage).toBe("pain_only");
  });

  it("returns no mentions when rawText is null", () => {
    const parsed = parseBrandGroundedRun({ ...baseRun, rawText: null }, ["Linear"]);
    expect(parsed.mentions).toEqual([]);
  });
});
