// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-utils", () => ({
  getAuthUser: vi.fn(),
  ApiErrors: {
    unauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    internal: () => new Response(JSON.stringify({ error: "Internal error" }), { status: 500 }),
  },
  getRequestId: () => "test-request-id",
  attachRequestId: (res: Response) => res,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    headers: new Map(),
  }),
  RateLimitConfig: { api: {} },
  rateLimitedResponse: () => new Response(JSON.stringify({ error: "Rate limited" }), { status: 429 }),
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
import { getAuthUser } from "@/lib/api-utils";
import { NextRequest } from "next/server";

describe("receipt stats API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters out discarded receipt jobs in stats queries", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    });

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

    const request = new NextRequest("http://localhost:3000/api/receipts/stats");
    const response = await GET(request);
    expect(response.status).toBe(200);

    for (const call of vi.mocked(prisma.receiptJob.groupBy).mock.calls) {
      expect(call[0].where).toMatchObject({ discardedAt: null });
    }

    for (const call of vi.mocked(prisma.receiptJob.aggregate).mock.calls) {
      expect(call[0].where).toMatchObject({ discardedAt: null });
    }
  });
});
