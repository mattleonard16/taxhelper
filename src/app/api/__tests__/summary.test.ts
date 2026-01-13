// @vitest-environment node

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "@/lib/api-utils";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    checkRateLimit: vi.fn(async () => ({
      success: true,
      remaining: 99,
      reset: Date.now() + 60_000,
      headers: new Headers(),
    })),
  };
});

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

let GET: typeof import("@/app/api/summary/route").GET;
let prismaTransaction: {
  aggregate: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
};
let prismaUser: {
  findUnique: ReturnType<typeof vi.fn>;
};
let prismaQueryRaw: ReturnType<typeof vi.fn>;
let getAuthUserMock: ReturnType<typeof vi.fn>;

describe("summary API route", () => {
  beforeAll(async () => {
    ({ GET } = await import("@/app/api/summary/route"));

    const prismaModule = await import("@/lib/prisma");
    prismaTransaction = (prismaModule.prisma as unknown as { transaction: unknown }).transaction as typeof prismaTransaction;
    prismaUser = (prismaModule.prisma as unknown as { user: unknown }).user as typeof prismaUser;
    prismaQueryRaw = vi.mocked((prismaModule.prisma as unknown as { $queryRaw: unknown }).$queryRaw as ReturnType<typeof vi.fn>);

    const apiUtilsModule = await import("@/lib/api-utils");
    getAuthUserMock = vi.mocked(apiUtilsModule.getAuthUser);
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-16T15:00:00Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("GET /api/summary returns 401 without session", async () => {
    getAuthUserMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/summary");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("GET /api/summary uses date range filter and returns computed totals", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    // Mock user timezone lookup
    prismaUser.findUnique.mockResolvedValue({ timezone: "America/Los_Angeles" });

    prismaTransaction.aggregate.mockResolvedValue({
      _sum: {
        taxAmount: new Prisma.Decimal(10),
        totalAmount: new Prisma.Decimal(100),
      },
      _count: 3,
    });

    // Mock groupBy - called twice: once for type, once for merchant
    prismaTransaction.groupBy
      .mockResolvedValueOnce([
        {
          type: "SALES_TAX",
          _sum: {
            taxAmount: new Prisma.Decimal(10),
            totalAmount: new Prisma.Decimal(80),
          },
        },
      ])
      .mockResolvedValueOnce([
        { merchant: "Amazon", _sum: { taxAmount: new Prisma.Decimal(10) } },
      ]);

    // Mock $queryRaw for daily aggregations
    prismaQueryRaw.mockResolvedValue([
      // route.ts uses TO_CHAR(..., 'YYYY-MM-DD') so date_key is a string
      { date_key: "2024-01-15", total_tax: new Prisma.Decimal(7) },
      { date_key: "2024-01-16", total_tax: new Prisma.Decimal(3) },
    ]);

    const request = new NextRequest("http://localhost/api/summary?from=2024-01-01&to=2024-01-31");
    const response = await GET(request);

    expect(response.status).toBe(200);

    expect(prismaTransaction.aggregate).toHaveBeenCalledTimes(1);
    const aggregateArgs = prismaTransaction.aggregate.mock.calls[0][0];
    expect(aggregateArgs.where.userId).toBe(user.id);
    expect(aggregateArgs.where.date).toMatchObject({
      gte: expect.any(Date),
      lte: expect.any(Date),
    });

    const json = await response.json();
    expect(json).toMatchObject({
      totalTax: "10",
      totalSpent: "100",
      taxShare: 0.1,
      todayTax: "3",
      transactionCount: 3,
      byType: { SALES_TAX: "10", INCOME_TAX: "0", OTHER: "0" },
      byTypeTotals: { SALES_TAX: "80", INCOME_TAX: "0", OTHER: "0" },
    });
    expect(json.timeseries).toEqual([
      { date: "2024-01-15", tax: "7" },
      { date: "2024-01-16", tax: "3" },
    ]);
    expect(json.topMerchants[0]).toMatchObject({ merchant: "Amazon", tax: "10" });
  });
});
