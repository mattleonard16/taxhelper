import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDashboardData } from "@/hooks/use-dashboard-data";

const summary = {
  totalTax: "0.00",
  totalSpent: "0.00",
  taxShare: 0,
  todayTax: "0.00",
  avgDailyTax: "0.00",
  daysTracked: 1,
  byType: {
    SALES_TAX: "0.00",
    INCOME_TAX: "0.00",
    OTHER: "0.00",
  },
  byTypeTotals: {
    SALES_TAX: "0.00",
    INCOME_TAX: "0.00",
    OTHER: "0.00",
  },
  timeseries: [{ date: "2024-01-01", tax: "0.00" }],
  topMerchants: [{ merchant: "Starbucks", tax: "0.00" }],
  transactionCount: 1,
};

const transactions = [
  {
    id: "tx-1",
    date: "2024-01-01",
    type: "SALES_TAX",
    description: null,
    merchant: "Starbucks",
    totalAmount: "10.00",
    taxAmount: "0.80",
    currency: "USD",
  },
];

const receiptStats = {
  receipts: { total: 0, processed: 0, pending: 0, failed: 0 },
  tax: { totalPaid: "0.00", totalSpent: "0.00", transactionCount: 0 },
  deductions: { total: "0.00", count: 0 },
  categories: [],
  avgConfidence: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useDashboardData", () => {
  it("loads summary, transactions, and receipt stats", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.startsWith("/api/recurring/generate")) {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }

      if (url.startsWith("/api/summary")) {
        return Promise.resolve({ ok: true, json: async () => summary });
      }

      if (url.startsWith("/api/transactions")) {
        return Promise.resolve({ ok: true, json: async () => ({ transactions }) });
      }

      if (url.startsWith("/api/receipts/stats")) {
        return Promise.resolve({ ok: true, json: async () => receiptStats });
      }

      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDashboardData());
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data.summary).toEqual(summary);
    expect(result.current.data.transactions).toEqual(transactions);
    expect(result.current.data.receiptStats).toEqual(receiptStats);
  });
});
