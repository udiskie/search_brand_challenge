import path from "node:path";
import {
  aeoDir,
  clustersDir,
  extractedDir,
  productDir,
  readAllJson,
  readJson,
  writeJson,
} from "../scraper/datalake";
import type { Tagcloud } from "../scraper/types";
import type { BrandGroundedRunResult, GeminiRunResult } from "../aeo/types";
import type { GeminiClientConfig } from "../aeo/geminiClient";
import { clusterTermsByTaxonomy } from "./clusterTerms";
import { clusterTermsByLlm } from "./clusterTermsByLlm";
import { correlateAnswers, correlateQuestions, type CandidateQuestionsInput } from "./correlate";
import type { ClusteringMethod, ThemeClustering } from "./types";

export interface RunTermClusteringOptions {
  /** Required when method is "llm"; ignored for "taxonomy". */
  geminiConfig?: Pick<GeminiClientConfig, "apiKey" | "model" | "timeoutMs" | "maxRetries">;
}

/**
 * Runs term clustering (taxonomy or LLM -- see term-clustering's SKILL.md
 * for the comparison) and correlates the resulting themes against
 * candidate questions and Gemini's raw answers. Every input besides the
 * tagcloud is optional: a product that hasn't run `npm run questions` or
 * `npm run aeo` yet still gets a valid (partially empty) clustering
 * rather than an error.
 */
export async function runTermClustering(
  product: string,
  method: ClusteringMethod,
  options: RunTermClusteringOptions = {},
  fetchImpl: typeof fetch = fetch
): Promise<ThemeClustering> {
  const tagcloud = await readJson<Tagcloud>(
    path.join(extractedDir(product), "tagcloud.json")
  );
  if (!tagcloud) {
    throw new Error(
      `Missing tagcloud.json for product "${product}" in datalake/${product}/extracted/. ` +
        `Run "npm run scrape -- --product ${product} --url <site>" first.`
    );
  }

  let clusteredThemes;
  let unclustered;
  if (method === "taxonomy") {
    ({ themes: clusteredThemes, unclustered } = clusterTermsByTaxonomy(tagcloud.site));
  } else {
    if (!options.geminiConfig) {
      throw new Error('"llm" clustering requires a Gemini API key (geminiConfig).');
    }
    ({ themes: clusteredThemes, unclustered } = await clusterTermsByLlm(
      tagcloud.site,
      options.geminiConfig,
      fetchImpl
    ));
  }

  const candidateQuestions = await readJson<CandidateQuestionsInput>(
    path.join(productDir(product), "questions", "candidate_user_questions.json")
  );
  const neutralRuns = await readAllJson<GeminiRunResult>(path.join(aeoDir(product), "runs"));
  const brandGroundedRuns = await readAllJson<BrandGroundedRunResult>(
    path.join(aeoDir(product), "brand_grounded_runs")
  );

  let themes = correlateQuestions(clusteredThemes, candidateQuestions);
  themes = correlateAnswers(themes, neutralRuns, "neutralAnswers");
  themes = correlateAnswers(themes, brandGroundedRuns, "brandGroundedAnswers");

  const clustering: ThemeClustering = {
    product,
    method,
    generatedAt: new Date().toISOString(),
    themes,
    unclustered,
  };

  await writeJson(
    path.join(clustersDir(product), `theme_clusters.${method}.json`),
    clustering
  );

  return clustering;
}
