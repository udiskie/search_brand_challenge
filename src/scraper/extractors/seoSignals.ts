import * as cheerio from "cheerio";
import type { HeadingEntry, StructuredSignals } from "../types";
import { countTerms, extractVisibleText, tokenize, wordCount } from "./text";

function collectSchemaTypes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    node.forEach((entry) => collectSchemaTypes(entry, out));
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj["@type"] === "string") out.add(obj["@type"]);
    if (Array.isArray(obj["@type"])) {
      for (const t of obj["@type"]) {
        if (typeof t === "string") out.add(t);
      }
    }
    if (Array.isArray(obj["@graph"])) collectSchemaTypes(obj["@graph"], out);
  }
}

export function extractSeoSignals(url: string, html: string): StructuredSignals {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;

  const headings: HeadingEntry[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    headings.push({
      tag: el.tagName.toLowerCase(),
      text: $(el).text().trim(),
    });
  });

  const h1Count = headings.filter((h) => h.tag === "h1").length;
  const headingOrderIssues: string[] = [];
  if (h1Count === 0) headingOrderIssues.push("missing h1");
  if (h1Count > 1) headingOrderIssues.push(`multiple h1 tags (${h1Count})`);

  let lastLevel = 0;
  for (const h of headings) {
    const level = Number(h.tag[1]);
    if (lastLevel > 0 && level > lastLevel + 1) {
      headingOrderIssues.push(
        `heading level skipped: h${lastLevel} -> h${level} ("${h.text.slice(0, 40)}")`
      );
    }
    lastLevel = level;
  }

  const schemaTypes = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collectSchemaTypes(JSON.parse($(el).text()), schemaTypes);
    } catch {
      // malformed JSON-LD -- ignore rather than fail the whole page
    }
  });
  $("[itemtype]").each((_, el) => {
    const itemtype = $(el).attr("itemtype");
    if (itemtype) schemaTypes.add(itemtype.split("/").pop() ?? itemtype);
  });

  let pageHost: string | null = null;
  try {
    pageHost = new URL(url).hostname;
  } catch {
    pageHost = null;
  }

  let internalLinkCount = 0;
  let externalLinkCount = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }
    try {
      const resolved = new URL(href, url);
      if (pageHost && resolved.hostname === pageHost) internalLinkCount++;
      else externalLinkCount++;
    } catch {
      internalLinkCount++;
    }
  });

  const images = $("img");
  const imagesTotal = images.length;
  let imagesMissingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (!alt || !alt.trim()) imagesMissingAlt++;
  });

  const visibleText = extractVisibleText($);
  const tokens = tokenize(visibleText);
  const termCounts = countTerms(tokens);
  const topKeywordDensity = [...termCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({
      term,
      count,
      density: tokens.length > 0 ? count / tokens.length : 0,
    }));

  return {
    url,
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    headings,
    h1Count,
    headingOrderIssues,
    schemaTypes: [...schemaTypes],
    internalLinkCount,
    externalLinkCount,
    imagesTotal,
    imagesMissingAlt,
    wordCount: wordCount(visibleText),
    topKeywordDensity,
  };
}
