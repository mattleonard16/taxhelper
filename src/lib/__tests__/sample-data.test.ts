import { describe, expect, it } from "vitest";
import { generateSampleTransactions, DEMO_PREFIX } from "../sample-data";

describe("sample-data", () => {
  describe("DEMO_PREFIX", () => {
    it("should be a recognizable prefix", () => {
      expect(DEMO_PREFIX).toBe("[DEMO]");
    });
  });

  describe("generateSampleTransactions", () => {
    it("should generate multiple transactions", () => {
      const transactions = generateSampleTransactions();
      expect(transactions.length).toBeGreaterThan(10);
    });

    it("should prefix all descriptions with DEMO_PREFIX", () => {
      const transactions = generateSampleTransactions();
      transactions.forEach((tx) => {
        expect(tx.description.startsWith(DEMO_PREFIX)).toBe(true);
      });
    });

    it("should generate valid transaction types", () => {
      const transactions = generateSampleTransactions();
      const validTypes = ["SALES_TAX", "INCOME_TAX", "OTHER"];
      transactions.forEach((tx) => {
        expect(validTypes).toContain(tx.type);
      });
    });

    it("should generate transactions with valid amounts", () => {
      const transactions = generateSampleTransactions();
      transactions.forEach((tx) => {
        expect(tx.totalAmount).toBeGreaterThan(0);
        expect(tx.taxAmount).toBeGreaterThanOrEqual(0);
        expect(tx.taxAmount).toBeLessThanOrEqual(tx.totalAmount);
      });
    });

    it("should generate transactions with dates within the past 30 days", () => {
      const now = new Date();
      // Allow for today's transactions (generated at noon, may be in future if test runs before noon)
      const upperBound = new Date(now);
      upperBound.setDate(upperBound.getDate() + 1);
      // Lower bound is 30 days ago
      const lowerBound = new Date(now);
      lowerBound.setDate(lowerBound.getDate() - 31);

      const transactions = generateSampleTransactions();
      transactions.forEach((tx) => {
        expect(tx.date.getTime()).toBeLessThanOrEqual(upperBound.getTime());
        expect(tx.date.getTime()).toBeGreaterThanOrEqual(lowerBound.getTime());
      });
    });

    it("should generate transactions with merchant names", () => {
      const transactions = generateSampleTransactions();
      transactions.forEach((tx) => {
        expect(tx.merchant).toBeTruthy();
        expect(typeof tx.merchant).toBe("string");
      });
    });

    it("should include variety of merchants for insights generation", () => {
      const transactions = generateSampleTransactions();
      const merchants = new Set(transactions.map((tx) => tx.merchant));
      // Should have multiple unique merchants
      expect(merchants.size).toBeGreaterThan(5);
    });

    it("should include transactions suitable for quiet leak detection", () => {
      const transactions = generateSampleTransactions();
      // Should have recurring purchases at same merchant
      const merchantCounts = new Map<string, number>();
      transactions.forEach((tx) => {
        const count = merchantCounts.get(tx.merchant) || 0;
        merchantCounts.set(tx.merchant, count + 1);
      });

      // At least one merchant should have multiple purchases (for quiet leak pattern)
      const hasRecurringMerchant = Array.from(merchantCounts.values()).some(
        (count) => count > 1
      );
      expect(hasRecurringMerchant).toBe(true);
    });
  });
});
