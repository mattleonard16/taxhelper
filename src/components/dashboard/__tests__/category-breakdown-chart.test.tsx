import { describe, expect, it } from "vitest";
import { formatCategoryPercent } from "../category-breakdown-chart";

describe("formatCategoryPercent", () => {
  it("returns 0.0% when total is 0", () => {
    expect(formatCategoryPercent(10, 0)).toBe("0.0%");
  });

  it("formats percentage with one decimal", () => {
    expect(formatCategoryPercent(25, 100)).toBe("25.0%");
  });
});
