import { describe, expect, it } from "vitest";
import { classifyPageType } from "./pagesIndex";

describe("classifyPageType", () => {
  it("classifies the home page", () => {
    expect(classifyPageType("https://linear.app/")).toBe("home");
    expect(classifyPageType("https://linear.app")).toBe("home");
  });

  it("classifies pricing pages in English and Spanish", () => {
    expect(classifyPageType("https://linear.app/pricing")).toBe("pricing");
    expect(classifyPageType("https://example.com/precios")).toBe("pricing");
  });

  it("classifies blog pages", () => {
    expect(classifyPageType("https://linear.app/blog/2024-recap")).toBe("blog");
  });

  it("classifies docs/help pages", () => {
    expect(classifyPageType("https://linear.app/docs/getting-started")).toBe("docs");
    expect(classifyPageType("https://linear.app/help/faq")).toBe("docs");
  });

  it("falls back to other", () => {
    expect(classifyPageType("https://linear.app/careers")).toBe("other");
  });
});
