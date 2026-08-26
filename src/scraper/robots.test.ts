import { describe, expect, it } from "vitest";
import { parseRobotsTxt } from "./robots";

describe("parseRobotsTxt", () => {
  it("allows everything when there are no rules", () => {
    const checker = parseRobotsTxt("");
    expect(checker.isAllowed("/anything")).toBe(true);
  });

  it("disallows paths under a blocked prefix for the wildcard agent", () => {
    const checker = parseRobotsTxt(
      ["User-agent: *", "Disallow: /admin", "Disallow: /internal/"].join("\n")
    );
    expect(checker.isAllowed("/admin/users")).toBe(false);
    expect(checker.isAllowed("/internal/tools")).toBe(false);
    expect(checker.isAllowed("/pricing")).toBe(true);
  });

  it("lets a more specific Allow override a broader Disallow", () => {
    const checker = parseRobotsTxt(
      ["User-agent: *", "Disallow: /blog", "Allow: /blog/public"].join("\n")
    );
    expect(checker.isAllowed("/blog/draft")).toBe(false);
    expect(checker.isAllowed("/blog/public/post-1")).toBe(true);
  });

  it("ignores rules scoped to a non-wildcard user-agent", () => {
    const checker = parseRobotsTxt(
      ["User-agent: Googlebot", "Disallow: /", "User-agent: *", "Disallow: /admin"].join(
        "\n"
      )
    );
    expect(checker.isAllowed("/pricing")).toBe(true);
    expect(checker.isAllowed("/admin")).toBe(false);
  });
});
