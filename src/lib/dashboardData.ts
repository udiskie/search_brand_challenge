import { readdir } from "node:fs/promises";
import path from "node:path";
import type {
  AeoAuditConfig,
  BrandGroundedRunResult,
  GeminiRunResult,
  GeneratedPrompt,
  Report,
} from "@/aeo/types";
import type {
  CandidateQuestion,
  InferentialQuestion,
  ProblemClaim,
  ProductHook,
} from "@/questionGenerator/types";
import {
  aeoDir,
  datalakeRoot,
  extractedDir,
  productDir,
  readJson,
  reportDir,
} from "@/scraper/datalake";
import type { Tagcloud } from "@/scraper/types";

export interface CandidateQuestionsFile {
  hooks: ProductHook[];
  hookQuestions: CandidateQuestion[];
  claims: ProblemClaim[];
  inferentialQuestions: InferentialQuestion[];
}

export interface PromptsConfigFile {
  config: AeoAuditConfig;
  prompts: GeneratedPrompt[];
}

async function readAllJsonInDir<T>(dir: string): Promise<T[]> {
  try {
    const files = await readdir(dir);
    const items = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map((file) => readJson<T>(path.join(dir, file)))
    );
    return items.filter((item) => item !== undefined) as T[];
  } catch {
    return [];
  }
}

export interface ProductSummary {
  product: string;
  report?: Report;
}

/** Every product directory under datalake/, sorted -- [] if the dir doesn't exist yet. */
export async function listProducts(): Promise<string[]> {
  try {
    const entries = await readdir(datalakeRoot(), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

export async function getReport(product: string): Promise<Report | undefined> {
  return readJson<Report>(path.join(reportDir(product), "report.json"));
}

export async function getTagcloud(product: string): Promise<Tagcloud | undefined> {
  return readJson<Tagcloud>(path.join(extractedDir(product), "tagcloud.json"));
}

export async function getCandidateQuestions(
  product: string
): Promise<CandidateQuestionsFile | undefined> {
  return readJson<CandidateQuestionsFile>(
    path.join(productDir(product), "questions", "candidate_user_questions.json")
  );
}

/** The neutral AEO prompt set as generated, before any Gemini calls. */
export async function getNeutralPromptsConfig(
  product: string
): Promise<PromptsConfigFile | undefined> {
  return readJson<PromptsConfigFile>(path.join(aeoDir(product), "prompts_config.json"));
}

/** Every individual neutral-prompt call actually sent to Gemini, raw response included. */
export async function getNeutralRuns(product: string): Promise<GeminiRunResult[]> {
  return readAllJsonInDir<GeminiRunResult>(path.join(aeoDir(product), "runs"));
}

/** Every individual brand-grounded (Part 1/2) call actually sent to Gemini. */
export async function getBrandGroundedRuns(product: string): Promise<BrandGroundedRunResult[]> {
  return readAllJsonInDir<BrandGroundedRunResult>(
    path.join(aeoDir(product), "brand_grounded_runs")
  );
}

/** One summary per product for the dashboard home page -- report is undefined for scrape-only products. */
export async function listProductSummaries(): Promise<ProductSummary[]> {
  const products = await listProducts();
  return Promise.all(
    products.map(async (product) => ({
      product,
      report: await getReport(product),
    }))
  );
}
