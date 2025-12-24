import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatCurrency } from "@/lib/format";
import DeductionsPage from "../page";

const sampleDeductions = {
  deductions: [
    {
      category: "BUSINESS_TRAVEL",
      potentialDeduction: 150,
      estimatedSavings: 37.5,
      transactions: ["tx_1", "tx_2"],
      suggestion: "Your 2 Uber rides totaling $150.00 may be deductible as Business Travel.",
    },
  ],
  totalPotentialDeduction: 150,
  estimatedTaxSavings: 37.5,
};

const sampleTransactions = [
  {
    id: "tx_1",
    date: "2024-01-10T00:00:00.000Z",
    type: "OTHER",
    description: "Airport ride",
    merchant: "Uber",
    totalAmount: "100.00",
    taxAmount: "0",
    currency: "USD",
  },
  {
    id: "tx_2",
    date: "2024-01-12T00:00:00.000Z",
    type: "OTHER",
    description: "Client visit",
    merchant: "Uber",
    totalAmount: "50.00",
    taxAmount: "0",
    currency: "USD",
  },
];

describe("DeductionsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders totals and category cards after loading", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/insights/deductions")) {
        return {
          ok: true,
          json: async () => sampleDeductions,
        } as Response;
      }

      if (url.includes("/api/transactions?ids=")) {
        return {
          ok: true,
          json: async () => ({ transactions: sampleTransactions }),
        } as Response;
      }

      return { ok: false, json: async () => ({}) } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DeductionsPage />);

    expect(await screen.findByText("Total Potential Deductions")).toBeInTheDocument();
    expect(screen.getAllByText(formatCurrency(150)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatCurrency(37.5)).length).toBeGreaterThan(0);

    expect(screen.getByText("Business Travel")).toBeInTheDocument();

    const viewLink = screen.getByRole("link", { name: /view transactions/i });
    expect(viewLink.getAttribute("href")).toContain("ids=tx_1,tx_2");

    const toggle = screen.getByRole("button", { name: /view 2 transactions/i });
    await user.click(toggle);

    expect((await screen.findAllByText("Uber")).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  it("shows empty state when no deductions exist", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/insights/deductions")) {
        return {
          ok: true,
          json: async () => ({
            deductions: [],
            totalPotentialDeduction: 0,
            estimatedTaxSavings: 0,
          }),
        } as Response;
      }

      return { ok: true, json: async () => ({ transactions: [] }) } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DeductionsPage />);

    expect(await screen.findByText("No deductions found.")).toBeInTheDocument();
    expect(screen.getByText("Add transactions to see potential savings.")).toBeInTheDocument();
  });
});
