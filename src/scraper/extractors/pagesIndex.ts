import type { PageIndexEntry, PageType } from "../types";

const PAGE_TYPE_RULES: { pattern: RegExp; type: PageType }[] = [
  { pattern: /^\/?(index\.html)?$/i, type: "home" },
  { pattern: /pricing|precios|planes/i, type: "pricing" },
  { pattern: /\/blog(\/|$)/i, type: "blog" },
  { pattern: /\/(docs|documentation|help|guide|guides)(\/|$)/i, type: "docs" },
];

export function classifyPageType(url: string): PageType {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }

  for (const { pattern, type } of PAGE_TYPE_RULES) {
    if (pattern.test(pathname)) return type;
  }
  return "other";
}

export function buildPageIndexEntry(
  url: string,
  urlHash: string,
  title: string | null
): PageIndexEntry {
  return { url, urlHash, title, pageType: classifyPageType(url) };
}
