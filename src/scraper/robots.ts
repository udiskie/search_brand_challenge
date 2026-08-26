interface Rule {
  prefix: string;
  allow: boolean;
}

export class RobotsChecker {
  private rules: Rule[];

  constructor(rules: Rule[]) {
    this.rules = rules;
  }

  /** Longest matching prefix wins, per the de-facto robots.txt convention. */
  isAllowed(pathname: string): boolean {
    let bestMatch: Rule | null = null;
    for (const rule of this.rules) {
      if (rule.prefix === "" || pathname.startsWith(rule.prefix)) {
        if (!bestMatch || rule.prefix.length > bestMatch.prefix.length) {
          bestMatch = rule;
        }
      }
    }
    return bestMatch ? bestMatch.allow : true;
  }
}

/**
 * Minimal robots.txt parser: reads the `User-agent: *` group only and
 * collects its Allow/Disallow rules. Good enough for a polite scraper;
 * does not implement wildcard/`$` pattern matching beyond prefix rules.
 */
export function parseRobotsTxt(content: string): RobotsChecker {
  const lines = content.split(/\r?\n/);
  const rules: Rule[] = [];
  let inWildcardGroup = false;
  let sawAnyGroup = false;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      sawAnyGroup = true;
      inWildcardGroup = value === "*";
      continue;
    }

    if (!inWildcardGroup) continue;

    if (key === "disallow" && value) {
      rules.push({ prefix: value, allow: false });
    } else if (key === "allow" && value) {
      rules.push({ prefix: value, allow: true });
    }
  }

  if (!sawAnyGroup) return new RobotsChecker([]);
  return new RobotsChecker(rules);
}

export async function fetchRobots(
  siteUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<RobotsChecker> {
  try {
    const base = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
    const res = await fetchImpl(`${base}/robots.txt`, {
      headers: { "user-agent": "search-brand-datalake-scraper" },
    });
    if (!res.ok) return new RobotsChecker([]);
    return parseRobotsTxt(await res.text());
  } catch {
    return new RobotsChecker([]);
  }
}
