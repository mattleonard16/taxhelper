// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    receiptJob: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    transaction: {
      aggregate: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/receipts/stats/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

describe("receipt stats API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters out discarded receipt jobs in stats queries", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never);

    vi.mocked(prisma.receiptJob.groupBy)
      .mockResolvedValueOnce([{ status: "COMPLETED", _count: { id: 1 } }] as never)
      .mockResolvedValueOnce([] as never);

    vi.mocked(prisma.receiptJob.aggregate)
      .mockResolvedValueOnce({ _sum: { totalAmount: null }, _count: { id: 0 } } as never)
      .mockResolvedValueOnce({ _avg: { extractionConfidence: null } } as never);

    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { totalAmount: null, taxAmount: null },
      _count: { id: 0 },
    } as never);

    const response = await GET();
    expect(response.status).toBe(200);

    for (const call of vi.mocked(prisma.receiptJob.groupBy).mock.calls) {
      expect(call[0].where).toMatchObject({ discardedAt: null });
    }

    for (const call of vi.mocked(prisma.receiptJob.aggregate).mock.calls) {
      expect(call[0].where).toMatchObject({ discardedAt: null });
    }
  });
});
