import { describe, expect, it } from "vitest";
import { buildTagcloud } from "./tagcloud";

describe("buildTagcloud", () => {
  const pages = [
    { url: "a", text: "Linear linear issue tracker fast software." },
    { url: "b", text: "Jira jira project management slow software." },
  ];

  it("ranks a repeated, page-specific term above single-occurrence shared terms", () => {
    const { byPage } = buildTagcloud(pages);
    expect(byPage.a[0].term).toBe("linear");
    expect(byPage.b[0].term).toBe("jira");
  });

  it("gives a lower idf boost to a term shared across all documents", () => {
    const { site } = buildTagcloud(pages);
    const linear = site.find((t) => t.term === "linear");
    const software = site.find((t) => t.term === "software");
    expect(linear).toBeDefined();
    expect(software?.documentFrequency).toBe(2);
    expect(linear?.documentFrequency).toBe(1);
  });

  it("counts raw occurrences separately from the idf-weighted score", () => {
    const { site } = buildTagcloud(pages);
    const linear = site.find((t) => t.term === "linear");
    // "Linear linear" appears twice in page a's text.
    expect(linear?.occurrences).toBe(2);
  });

  it("sorts the site tagcloud by score descending", () => {
    const { site } = buildTagcloud(pages);
    for (let i = 1; i < site.length; i++) {
      expect(site[i - 1].score).toBeGreaterThanOrEqual(site[i].score);
    }
  });

  it("respects the topN and perPageTopN caps", () => {
    const { site, byPage } = buildTagcloud(pages, 2, 1);
    expect(site.length).toBeLessThanOrEqual(2);
    expect(byPage.a.length).toBeLessThanOrEqual(1);
  });
});
