import { describe, expect, it } from "vitest";
import { calculateBalanceTotals } from "../balance-card";

describe("calculateBalanceTotals", () => {
  it("calculates income, expenses, and balance from byTypeTotals", () => {
    const totals = {
      SALES_TAX: "200",
      INCOME_TAX: "1000",
      OTHER: "50",
    };

    expect(calculateBalanceTotals(totals)).toEqual({
      income: 1000,
      expenses: 250,
      balance: 750,
    });
  });

  it("defaults missing values to 0", () => {
    const totals = {
      SALES_TAX: "",
      INCOME_TAX: "0",
      OTHER: "",
    };

    expect(calculateBalanceTotals(totals)).toEqual({
      income: 0,
      expenses: 0,
      balance: 0,
    });
  });

  it("returns zeros when totals are undefined", () => {
    expect(calculateBalanceTotals(undefined)).toEqual({
      income: 0,
      expenses: 0,
      balance: 0,
    });
  });
});
