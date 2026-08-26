import type { CheerioAPI } from "cheerio";

// Small, combined ES/EN stopword list -- good enough to keep noise words out
// of the tagcloud/phrase cloud without pulling in an NLP dependency.
const STOPWORDS = new Set(
  [
    "the", "a", "an", "and", "or", "but", "if", "then", "so", "of", "to",
    "in", "on", "at", "for", "with", "without", "is", "are", "was", "were",
    "be", "been", "being", "it", "its", "this", "that", "these", "those",
    "as", "by", "from", "into", "your", "you", "we", "our", "us", "they",
    "their", "he", "she", "his", "her", "not", "no", "yes", "can", "will",
    "just", "more", "most", "than", "all", "any", "have", "has", "had",
    "do", "does", "did", "up", "out", "about", "how", "what", "when",
    "where", "which", "who", "why", "get", "one", "new",
    "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "pero",
    "si", "de", "del", "al", "a", "en", "para", "por", "con", "sin", "es",
    "son", "era", "eran", "ser", "estar", "esta", "este", "estos", "estas",
    "como", "que", "su", "sus", "tu", "tus", "nuestro", "nuestra", "ellos",
    "ellas", "no", "mas", "todo", "toda", "todos", "todas", "hay", "muy",
  ].map((w) => w.toLowerCase())
);

/** Strips script/style/nav/header/footer noise and returns visible text. */
export function extractVisibleText($: CheerioAPI): string {
  const $body = $.root().clone();
  $body.find("script, style, nav, header, footer, noscript, template").remove();
  return $body
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-záéíóúñü]+/gi) ?? []).filter(
    (token) => token.length > 2 && !STOPWORDS.has(token)
  );
}

export function countTerms(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

export function wordCount(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

/** Splits visible text into naive sentences for phrase-cloud snippets. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
