import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Report } from "@/aeo/types";
import type {
  CandidateQuestion,
  InferentialQuestion,
  ProblemClaim,
  ProductHook,
} from "@/questionGenerator/types";
import {
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
