import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types";
import { detectDeductionInsights } from "../deductions";

function createTransaction(
  overrides: Partial<Transaction> & { merchant: string; totalAmount: string }
): Transaction {
  return {
    id: `txn-${Math.random().toString(36).slice(2)}`,
    date: new Date().toISOString(),
    type: "OTHER",
    description: null,
    currency: "USD",
    taxAmount: "0",
    ...overrides,
  };
}

describe("detectDeductionInsights", () => {
  it("groups deduction insights by category", () => {
    const transactions: Transaction[] = [
      createTransaction({
        id: "tx-uber-1",
        merchant: "Uber",
        description: "Airport ride",
        totalAmount: "100.00",
      }),
      createTransaction({
        id: "tx-uber-2",
        merchant: "Uber",
        description: "Client visit ride",
        totalAmount: "50.00",
      }),
      createTransaction({
        id: "tx-staples",
        merchant: "Staples",
        description: "Printer ink",
        totalAmount: "80.00",
      }),
    ];

    const insights = detectDeductionInsights(transactions, {
      isFreelancer: true,
      estimatedTaxRate: 0.25,
    });

    expect(insights).toHaveLength(2);

    const travelInsight = insights.find((insight) =>
      insight.title.includes("Business Travel")
    );
    expect(travelInsight?.type).toBe("DEDUCTION");
    expect(travelInsight?.supportingTransactionIds).toEqual(
      expect.arrayContaining(["tx-uber-1", "tx-uber-2"])
    );
    expect(travelInsight?.summary).toContain("$150.00");

    const officeInsight = insights.find((insight) =>
      insight.title.includes("Office Supplies")
    );
    expect(officeInsight?.supportingTransactionIds).toEqual(
      expect.arrayContaining(["tx-staples"])
    );
  });

  it("returns empty when no deductions are found", () => {
    const transactions: Transaction[] = [
      createTransaction({
        merchant: "Local Grocery",
        description: "Groceries",
        totalAmount: "75.00",
      }),
    ];

    const insights = detectDeductionInsights(transactions, {});

    expect(insights).toHaveLength(0);
  });
});
