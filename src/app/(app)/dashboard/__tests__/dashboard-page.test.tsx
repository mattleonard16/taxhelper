import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/(app)/dashboard/page";

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

beforeAll(() => {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(window, "ResizeObserver", { value: ResizeObserver });
  Object.defineProperty(global, "ResizeObserver", { value: ResizeObserver });

  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    value: () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DashboardPage", () => {
  it("renders empty state for category breakdown when no categories exist", async () => {
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

    render(<DashboardPage />);

    expect(
      await screen.findByText(/No categorized receipts yet\./i)
    ).toBeInTheDocument();
  });
});
