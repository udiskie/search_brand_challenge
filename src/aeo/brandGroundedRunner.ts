import { randomUUID } from "node:crypto";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { aeoDir, writeJson } from "../scraper/datalake";
import { callGemini, type GeminiClientConfig } from "./geminiClient";
import { extractMentions } from "./mentionExtractor";
import type { BrandGroundedParsedRun, BrandGroundedPrompt, BrandGroundedRunResult } from "./types";

/**
 * Runs Part 1/Part 2 candidate questions through Gemini, mirroring
 * runGeminiForPrompts()'s retry/concurrency/persistence behavior but kept
 * as a separate function (rather than generalizing that one) since these
 * prompts carry a different, non-neutral dimension shape (source/templateId/
 * stage instead of intent/persona/specificity/attribute/language) -- see
 * types.ts's BrandGroundedPrompt doc comment for why they're not merged.
 * Every raw response is persisted under datalake/{product}/aeo/brand_grounded_runs/
 * before any parsing, same auditability guarantee as the neutral path.
 */
export async function runGeminiForBrandGroundedPrompts(
  product: string,
  prompts: BrandGroundedPrompt[],
  runsPerPrompt: number,
  config: GeminiClientConfig,
  fetchImpl: typeof fetch = fetch
): Promise<BrandGroundedRunResult[]> {
  const jobs: BrandGroundedPrompt[] = [];
  for (const prompt of prompts) {
    for (let i = 0; i < runsPerPrompt; i++) jobs.push(prompt);
  }

  const results: BrandGroundedRunResult[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < jobs.length) {
      const current = nextIndex++;
      if (current > 0) await delay(config.requestDelayMs);
      const prompt = jobs[current];

      const { text, finishReason, error } = await callGemini(prompt.text, config, fetchImpl);

      const result: BrandGroundedRunResult = {
        runId: randomUUID(),
        promptId: prompt.id,
        promptText: prompt.text,
        source: prompt.source,
        templateId: prompt.templateId,
        stage: prompt.stage,
        temperature: config.temperature,
        timestamp: new Date().toISOString(),
        finishReason,
        rawText: text,
        error,
      };

      await writeJson(
        path.join(aeoDir(product), "brand_grounded_runs", `${result.runId}.json`),
        result
      );
      results.push(result);
    }
  }

  const workerCount = Math.max(1, Math.min(config.concurrency, jobs.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}

export function parseBrandGroundedRun(
  run: BrandGroundedRunResult,
  brands: string[]
): BrandGroundedParsedRun {
  return {
    runId: run.runId,
    promptId: run.promptId,
    source: run.source,
    stage: run.stage,
    mentions: run.rawText ? extractMentions(run.rawText, brands) : [],
  };
}
