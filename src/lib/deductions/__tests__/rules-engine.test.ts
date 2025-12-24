import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types";
import { matchDeductionRules } from "../rules-engine";

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

describe("matchDeductionRules", () => {
  it("matches business travel for rideshare merchants", () => {
    const transaction = createTransaction({
      merchant: "Uber",
      description: "Airport ride",
      totalAmount: "45.00",
    });

    const matches = matchDeductionRules(transaction, { isFreelancer: true });
    const travelMatch = matches.find((match) => match.category === "BUSINESS_TRAVEL");

    expect(travelMatch).toBeTruthy();
    expect(travelMatch?.deductionPercent).toBe(1);
    expect(travelMatch?.confidence).toBeGreaterThan(0.6);
  });

  it("requires worksFromHome for home office internet deductions", () => {
    const transaction = createTransaction({
      merchant: "Comcast",
      description: "Internet bill",
      totalAmount: "90.00",
    });

    const wfhMatches = matchDeductionRules(transaction, { worksFromHome: true });
    const wfhHomeOffice = wfhMatches.find((match) => match.category === "HOME_OFFICE");

    expect(wfhHomeOffice).toBeTruthy();
    expect(wfhHomeOffice?.deductionPercent).toBeCloseTo(0.4, 2);

    const nonWfhMatches = matchDeductionRules(transaction, { worksFromHome: false });
    const nonWfhHomeOffice = nonWfhMatches.find((match) => match.category === "HOME_OFFICE");

    expect(nonWfhHomeOffice).toBeUndefined();
  });

  it("improves confidence when merchant matches keyword", () => {
    const merchantMatch = matchDeductionRules(
      createTransaction({
        merchant: "Lyft",
        description: "Ride to client site",
        totalAmount: "30.00",
      }),
      {}
    );

    const descriptionMatch = matchDeductionRules(
      createTransaction({
        merchant: "Local Transit",
        description: "Lyft ride",
        totalAmount: "30.00",
      }),
      {}
    );

    const merchantConfidence = merchantMatch.find(
      (match) => match.category === "BUSINESS_TRAVEL"
    )?.confidence;
    const descriptionConfidence = descriptionMatch.find(
      (match) => match.category === "BUSINESS_TRAVEL"
    )?.confidence;

    expect(merchantConfidence).toBeGreaterThan(descriptionConfidence ?? 0);
  });

  it("handles partial keyword matches with lower confidence", () => {
    const transaction = createTransaction({
      merchant: "Tech Events",
      description: "Conference ticket",
      totalAmount: "250.00",
    });

    const matches = matchDeductionRules(transaction, {});
    const match = matches.find((item) => item.category === "PROFESSIONAL_DEVELOPMENT");

    expect(match).toBeTruthy();
    expect(match?.confidence).toBeLessThan(0.8);
  });

  it("returns empty when no keywords match", () => {
    const transaction = createTransaction({
      merchant: "Grocery Mart",
      description: "Weekly groceries",
      totalAmount: "75.00",
    });

    const matches = matchDeductionRules(transaction, {});

    expect(matches).toHaveLength(0);
  });
});
