/**
 * True if `text` contains any excluded term as a substring (case-
 * insensitive). Sentence-level text (meta descriptions, GEO definitions,
 * extracted problem fragments) needs substring matching, not exact-match --
 * e.g. "Use Linear for free..." must be excluded for brand "Linear" even
 * though it isn't equal to it. Shared by both the hook scanner and the
 * problem/audience scanner so a brand-grounded question never accidentally
 * leaks the brand's own name into its wording.
 */
export function containsExcludedTerm(text: string, exclude: Set<string>): boolean {
  const lower = text.toLowerCase();
  for (const term of exclude) {
    if (term && lower.includes(term)) return true;
  }
  return false;
}
