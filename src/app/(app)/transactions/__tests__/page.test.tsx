import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/transactions",
  useSearchParams: () => new URLSearchParams("ids=tx_1,tx_2"),
}));

import TransactionsPage from "../page";

describe("TransactionsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies ids filter when provided in the query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        transactions: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 1 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TransactionsPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const firstCall = fetchMock.mock.calls[0]?.[0];
    const url = typeof firstCall === "string" ? firstCall : firstCall?.toString();
    const parsed = new URL(url ?? "", "http://localhost");

    expect(parsed.searchParams.get("ids")).toBe("tx_1,tx_2");
  });
});
