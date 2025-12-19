import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatShortDate,
  getDateRanges,
} from "../format";

describe("formatCurrency", () => {
  it("formats number as USD currency", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("formats string amount as currency", () => {
    expect(formatCurrency("99.99")).toBe("$99.99");
  });

  it("formats zero correctly", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("rounds to 2 decimal places", () => {
    expect(formatCurrency(10.999)).toBe("$11.00");
    expect(formatCurrency(10.001)).toBe("$10.00");
  });

  it("handles large numbers with commas", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000.00");
  });

  it("supports different currencies", () => {
    expect(formatCurrency(100, "EUR")).toBe("€100.00");
    expect(formatCurrency(100, "GBP")).toBe("£100.00");
  });
});

describe("formatPercent", () => {
  it("formats decimal as percentage", () => {
    expect(formatPercent(0.5)).toBe("50.0%");
  });

  it("formats small percentages", () => {
    expect(formatPercent(0.08875)).toBe("8.9%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("formats 100%", () => {
    expect(formatPercent(1)).toBe("100.0%");
  });

  it("rounds to 1 decimal place", () => {
    expect(formatPercent(0.12345)).toBe("12.3%");
    expect(formatPercent(0.12355)).toBe("12.4%");
  });
});

describe("formatDate", () => {
  it("formats Date object", () => {
    const date = new Date(2024, 5, 15); // June 15, 2024
    expect(formatDate(date)).toBe("Jun 15, 2024");
  });

  it("formats Date object for January", () => {
    const date = new Date(2024, 0, 1); // January 1, 2024
    expect(formatDate(date)).toBe("Jan 1, 2024");
  });

  it("formats ISO date string with time component", () => {
    expect(formatDate("2024-12-25T12:00:00")).toBe("Dec 25, 2024");
  });

  it("handles different months", () => {
    expect(formatDate(new Date(2024, 2, 10))).toBe("Mar 10, 2024");
    expect(formatDate(new Date(2024, 10, 28))).toBe("Nov 28, 2024");
  });
});

describe("formatShortDate", () => {
  it("formats Date object without year", () => {
    const date = new Date(2024, 5, 15); // June 15, 2024
    expect(formatShortDate(date)).toBe("Jun 15");
  });

  it("formats Date object for January", () => {
    const date = new Date(2024, 0, 1); // January 1, 2024
    expect(formatShortDate(date)).toBe("Jan 1");
  });

  it("handles single digit days", () => {
    expect(formatShortDate(new Date(2024, 8, 5))).toBe("Sep 5");
  });
});

describe("getDateRanges", () => {
  beforeEach(() => {
    // Mock date to 2024-06-15 (Saturday)
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns all expected range keys", () => {
    const ranges = getDateRanges();
    expect(Object.keys(ranges)).toEqual([
      "today",
      "last7Days",
      "thisWeek",
      "last30Days",
      "thisMonth",
      "thisYear",
    ]);
  });

  it("returns correct today range", () => {
    const { today } = getDateRanges();
    expect(today.label).toBe("Today");
    expect(today.from).toBe("2024-06-15");
    expect(today.to).toBe("2024-06-15");
  });

  it("returns correct last7Days range", () => {
    const { last7Days } = getDateRanges();
    expect(last7Days.label).toBe("Last 7 days");
    expect(last7Days.from).toBe("2024-06-09");
    expect(last7Days.to).toBe("2024-06-15");
  });

  it("returns correct thisWeek range (Sunday start)", () => {
    const { thisWeek } = getDateRanges();
    expect(thisWeek.label).toBe("This week");
    // June 15 2024 is Saturday, so week started on June 9 (Sunday)
    expect(thisWeek.from).toBe("2024-06-09");
    expect(thisWeek.to).toBe("2024-06-15");
  });

  it("returns correct last30Days range", () => {
    const { last30Days } = getDateRanges();
    expect(last30Days.label).toBe("Last 30 days");
    expect(last30Days.from).toBe("2024-05-17");
    expect(last30Days.to).toBe("2024-06-15");
  });

  it("returns correct thisMonth range", () => {
    const { thisMonth } = getDateRanges();
    expect(thisMonth.label).toBe("This month");
    expect(thisMonth.from).toBe("2024-06-01");
    expect(thisMonth.to).toBe("2024-06-15");
  });

  it("returns correct thisYear range", () => {
    const { thisYear } = getDateRanges();
    expect(thisYear.label).toBe("This year");
    expect(thisYear.from).toBe("2024-01-01");
    expect(thisYear.to).toBe("2024-06-15");
  });

  it("each range has label, from, and to properties", () => {
    const ranges = getDateRanges();
    for (const range of Object.values(ranges)) {
      expect(range).toHaveProperty("label");
      expect(range).toHaveProperty("from");
      expect(range).toHaveProperty("to");
      expect(typeof range.label).toBe("string");
      expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("all ranges end on today", () => {
    const ranges = getDateRanges();
    for (const range of Object.values(ranges)) {
      expect(range.to).toBe("2024-06-15");
    }
  });
});
