import { describe, expect, it } from "vitest";
import { extractGeoSignals } from "./geoSignals";

describe("extractGeoSignals", () => {
  it("finds a self-contained definition from the meta description", () => {
    const html = `<html><head>
      <meta name="description" content="Linear is the issue tracking tool built for high-performance software teams." />
    </head><body><p>Welcome.</p></body></html>`;
    const signals = extractGeoSignals("https://linear.app/", html);
    expect(signals.entityClarity.hasSelfContainedDefinition).toBe(true);
    expect(signals.entityClarity.definitionSnippet).toContain("issue tracking tool");
  });

  it("scores promotional-heavy copy lower on factual density than a data-heavy page", () => {
    const promoHtml = `<html><body><main><p>
      The best, most amazing, revolutionary and innovative tool ever built.
    </p></main></body></html>`;
    const factualHtml = `<html><body><main><p>
      Linear processes 10,000 issues per day, 3x faster than Jira for issue creation,
      and reports a 40% reduction in triage time compared to manual workflows.
    </p></main></body></html>`;

    const promo = extractGeoSignals("https://example.com/", promoHtml);
    const factual = extractGeoSignals("https://example.com/", factualHtml);

    expect(factual.factualDensity.score).toBeGreaterThan(promo.factualDensity.score);
  });

  it("detects E-E-A-T signals: author, publish date, updated date", () => {
    const html = `<html><head>
      <meta name="author" content="Jane Doe" />
      <meta property="article:published_time" content="2024-01-01" />
      <meta property="article:modified_time" content="2024-06-01" />
    </head><body><p>Body copy.</p></body></html>`;
    const signals = extractGeoSignals("https://example.com/blog/post", html);
    expect(signals.eeat.hasVisibleAuthor).toBe(true);
    expect(signals.eeat.hasPublishDate).toBe(true);
    expect(signals.eeat.hasUpdatedDate).toBe(true);
  });

  it("counts outbound citations only within main/article content", () => {
    const html = `<html><body>
      <nav><a href="https://twitter.com/x">nav link</a></nav>
      <main>
        <a href="https://en.wikipedia.org/wiki/Kanban">source</a>
        <a href="/internal">internal</a>
      </main>
    </body></html>`;
    const signals = extractGeoSignals("https://example.com/", html);
    expect(signals.eeat.outboundCitationCount).toBe(1);
  });

  it("counts extractable structure: lists, tables, definition blocks", () => {
    const html = `<html><body>
      <ul><li>a</li></ul>
      <ol><li>b</li></ol>
      <table><tr><td>c</td></tr></table>
      <dl><dt>Term</dt><dd>Definition</dd></dl>
    </body></html>`;
    const signals = extractGeoSignals("https://example.com/", html);
    expect(signals.extractableStructure.listCount).toBe(2);
    expect(signals.extractableStructure.tableCount).toBe(1);
    expect(signals.extractableStructure.definitionBlockCount).toBe(1);
    expect(signals.extractableStructure.score).toBeGreaterThan(0);
  });
});
