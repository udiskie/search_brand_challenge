import { randomUUID } from "node:crypto";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { aeoDir, writeJson } from "../scraper/datalake";
import type { GeminiRunResult, GeneratedPrompt } from "./types";

export interface GeminiClientConfig {
  apiKey: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  concurrency: number;
  requestDelayMs: number;
}

interface GeminiApiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  error?: { message?: string };
}

function backoffMs(attempt: number): number {
  return 500 * 2 ** attempt;
}

/** A single call to Gemini's REST generateContent endpoint, with retries. */
export async function callGemini(
  promptText: string,
  config: Pick<GeminiClientConfig, "apiKey" | "model" | "temperature" | "timeoutMs" | "maxRetries">,
  fetchImpl: typeof fetch = fetch
): Promise<{ text: string | null; finishReason: string | null; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: { temperature: config.temperature },
  });

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        if (attempt < config.maxRetries) {
          await delay(backoffMs(attempt));
          continue;
        }
        return { text: null, finishReason: null, error: lastError };
      }

      const json = (await res.json()) as GeminiApiResponse;
      if (!res.ok) {
        return {
          text: null,
          finishReason: null,
          error: json.error?.message ?? `HTTP ${res.status}`,
        };
      }

      const candidate = json.candidates?.[0];
      const text =
        candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? null;
      return { text, finishReason: candidate?.finishReason ?? null };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < config.maxRetries) {
        await delay(backoffMs(attempt));
        continue;
      }
    }
  }

  return { text: null, finishReason: null, error: lastError ?? "unknown error" };
}

/**
 * Runs each prompt `runsPerPrompt` times (temperature is expected to be
 * high, 0.8-1.0, set by the caller) to sample Gemini's non-determinism
 * rather than treat a single call as representative. Every raw response
 * is persisted under datalake/{product}/aeo/runs/ before any parsing.
 */
export async function runGeminiForPrompts(
  product: string,
  prompts: GeneratedPrompt[],
  runsPerPrompt: number,
  config: GeminiClientConfig,
  fetchImpl: typeof fetch = fetch
): Promise<GeminiRunResult[]> {
  const jobs: GeneratedPrompt[] = [];
  for (const prompt of prompts) {
    for (let i = 0; i < runsPerPrompt; i++) jobs.push(prompt);
  }

  const results: GeminiRunResult[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < jobs.length) {
      const current = nextIndex++;
      if (current > 0) await delay(config.requestDelayMs);
      const prompt = jobs[current];

      const { text, finishReason, error } = await callGemini(prompt.text, config, fetchImpl);

      const result: GeminiRunResult = {
        runId: randomUUID(),
        promptId: prompt.id,
        promptText: prompt.text,
        dimensions: prompt.dimensions,
        temperature: config.temperature,
        timestamp: new Date().toISOString(),
        finishReason,
        rawText: text,
        error,
      };

      await writeJson(
        path.join(aeoDir(product), "runs", `${result.runId}.json`),
        result
      );
      results.push(result);
    }
  }

  const workerCount = Math.max(1, Math.min(config.concurrency, jobs.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}
