import * as cheerio from "cheerio";
import type { GeoSignals } from "../types";
import { extractVisibleText } from "./text";

const PROMOTIONAL_ADJECTIVES = [
  "best", "amazing", "revolutionary", "world-class", "leading", "innovative",
  "seamless", "powerful", "effortless", "incredible", "cutting-edge",
  "game-changing", "unmatched", "ultimate", "unique", "next-generation",
  "mejor", "lider", "líder", "increible", "increíble", "innovador",
  "revolucionario", "excepcional", "impresionante",
];

const COMPARATIVE_PATTERN =
  /\b(vs\.?|versus|compared to|faster than|better than|more than|less than|frente a|comparado con)\b/gi;

const NUMBER_PATTERN = /\b\d+(?:[.,]\d+)?%?\b/g;

const DEFINITION_PATTERN = /\b(is|are|es|son)\s+(a|an|the|el|la|los|las|un|una)\b/i;

function findDefinitionSnippet(
  metaDescription: string | null,
  firstParagraphs: string[]
): string | null {
  if (metaDescription && metaDescription.length > 30) return metaDescription;
  for (const paragraph of firstParagraphs) {
    if (DEFINITION_PATTERN.test(paragraph)) return paragraph;
  }
  return null;
}

function countPromotionalAdjectives(text: string): number {
  const lower = text.toLowerCase();
  return PROMOTIONAL_ADJECTIVES.reduce(
    (count, word) => count + (lower.match(new RegExp(`\\b${word}\\b`, "g"))?.length ?? 0),
    0
  );
}

export function extractGeoSignals(url: string, html: string): GeoSignals {
  const $ = cheerio.load(html);
  const visibleText = extractVisibleText($);
  const firstParagraphs = $("p")
    .slice(0, 3)
    .map((_, el) => $(el).text().trim())
    .get();

  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const definitionSnippet = findDefinitionSnippet(metaDescription, firstParagraphs);

  const numberCount = (visibleText.match(NUMBER_PATTERN) ?? []).length;
  const comparativeStatements = (visibleText.match(COMPARATIVE_PATTERN) ?? []).length;
  const promotionalAdjectiveCount = countPromotionalAdjectives(visibleText);
  const factualSignals = numberCount + comparativeStatements;
  const factualDensityScore =
    factualSignals + promotionalAdjectiveCount > 0
      ? factualSignals / (factualSignals + promotionalAdjectiveCount)
      : 0;

  const hasVisibleAuthor =
    $('[rel="author"], .author, [class*="byline"]').length > 0 ||
    !!$('meta[name="author"]').attr("content") ||
    /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(visibleText);

  const hasPublishDate =
    $('meta[property="article:published_time"]').length > 0 ||
    $("time[datetime]").length > 0 ||
    /"datePublished"\s*:/.test(html);

  const hasUpdatedDate =
    $('meta[property="article:modified_time"]').length > 0 ||
    /"dateModified"\s*:/.test(html);

  let outboundCitationCount = 0;
  let pageHost: string | null = null;
  try {
    pageHost = new URL(url).hostname;
  } catch {
    pageHost = null;
  }
  $("main a[href], article a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, url);
      if (!pageHost || resolved.hostname !== pageHost) outboundCitationCount++;
    } catch {
      // ignore unparsable hrefs
    }
  });

  const listCount = $("ul, ol").length;
  const tableCount = $("table").length;
  const definitionBlockCount = $("dl").length;
  const structureSignals = listCount + tableCount + definitionBlockCount;
  const extractableStructureScore = Math.min(1, structureSignals / 10);

  return {
    url,
    entityClarity: {
      hasSelfContainedDefinition: definitionSnippet !== null,
      definitionSnippet,
    },
    factualDensity: {
      numberCount,
      comparativeStatements,
      promotionalAdjectiveCount,
      score: factualDensityScore,
    },
    eeat: {
      hasVisibleAuthor,
      hasPublishDate,
      hasUpdatedDate,
      outboundCitationCount,
    },
    extractableStructure: {
      listCount,
      tableCount,
      definitionBlockCount,
      score: extractableStructureScore,
    },
  };
}
