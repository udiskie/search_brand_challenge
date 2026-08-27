import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Resolved lazily (not cached at import time) so tests can chdir first. */
export function datalakeRoot(): string {
  return path.join(process.cwd(), "datalake");
}

export function urlHash(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

export function productDir(product: string): string {
  return path.join(datalakeRoot(), product);
}

export function rawDir(product: string): string {
  return path.join(productDir(product), "raw");
}

export function pagesDir(product: string): string {
  return path.join(rawDir(product), "pages");
}

export function extractedDir(product: string): string {
  return path.join(productDir(product), "extracted");
}

export function geoDir(product: string): string {
  return path.join(productDir(product), "geo");
}

export function aeoDir(product: string): string {
  return path.join(productDir(product), "aeo");
}

export function reportDir(product: string): string {
  return path.join(productDir(product), "report");
}

export function clustersDir(product: string): string {
  return path.join(productDir(product), "clusters");
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function writeText(filePath: string, data: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, data, "utf-8");
}

/** Returns undefined (rather than throwing) when the file doesn't exist. */
export async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

/** Every *.json file in `dir`, parsed -- [] if the directory doesn't exist. */
export async function readAllJson<T>(dir: string): Promise<T[]> {
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
