import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReceiptReviewDrawer } from "../receipt-review-drawer";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const baseJob = {
  id: "job-1",
  status: "NEEDS_REVIEW" as const,
  originalName: "receipt.jpg",
  mimeType: "image/jpeg",
  fileSize: 1200,
  merchant: "Test Store",
  date: "2024-01-01T00:00:00.000Z",
  totalAmount: "10.00",
  taxAmount: "0.80",
  category: null,
  categoryCode: null,
  isDeductible: false,
  extractionConfidence: 0.5,
  transactionId: null,
  lastError: null,
  createdAt: "2024-01-01T00:00:00.000Z",
};

describe("ReceiptReviewDrawer", () => {
  const onOpenChange = vi.fn();
  const onConfirmed = vi.fn();
  const onRetried = vi.fn();
  const onDeleted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("omits totalAmount when the field is blank", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(
      <ReceiptReviewDrawer
        job={baseJob}
        open={true}
        onOpenChange={onOpenChange}
        onConfirmed={onConfirmed}
        onRetried={onRetried}
        onDeleted={onDeleted}
      />
    );

    const totalInput = await screen.findByLabelText(/Total Amount/);
    await user.clear(totalInput);

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const [, init] = mockFetch.mock.calls[0];
    const payload = JSON.parse(init.body as string) as Record<string, unknown>;
    expect("totalAmount" in payload).toBe(false);
  });

  it("does not confirm when save fails", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Failed to save" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ confirmed: true }),
      });

    render(
      <ReceiptReviewDrawer
        job={baseJob}
        open={true}
        onOpenChange={onOpenChange}
        onConfirmed={onConfirmed}
        onRetried={onRetried}
        onDeleted={onDeleted}
      />
    );

    const confirmButton = await screen.findByRole("button", {
      name: /confirm & create transaction/i,
    });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    expect(
      mockFetch.mock.calls.some((call) => String(call[0]).includes("/confirm"))
    ).toBe(false);
  });
});
