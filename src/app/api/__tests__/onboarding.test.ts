// @vitest-environment node

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AuthenticatedUser } from "@/lib/api-utils";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    insightRun: {
      count: vi.fn(),
    },
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

let GET: typeof import("@/app/api/onboarding/route").GET;
let prismaTransaction: { count: ReturnType<typeof vi.fn> };
let prismaUser: { findUnique: ReturnType<typeof vi.fn> };
let prismaInsightRun: { count: ReturnType<typeof vi.fn> };
let getAuthUserMock: ReturnType<typeof vi.fn>;

describe("onboarding API route", () => {
  beforeAll(async () => {
    ({ GET } = await import("@/app/api/onboarding/route"));

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.prisma as unknown as {
      transaction: typeof prismaTransaction;
      user: typeof prismaUser;
      insightRun: typeof prismaInsightRun;
    };
    prismaTransaction = prisma.transaction;
    prismaUser = prisma.user;
    prismaInsightRun = prisma.insightRun;

    const apiUtilsModule = await import("@/lib/api-utils");
    getAuthUserMock = vi.mocked(apiUtilsModule.getAuthUser);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/onboarding returns 401 without session", async () => {
    getAuthUserMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/onboarding");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("GET /api/onboarding returns status with all incomplete", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    // No transactions
    prismaTransaction.count.mockResolvedValue(0);
    // No tax rate set
    prismaUser.findUnique.mockResolvedValue({ defaultTaxRate: null });
    // No insights
    prismaInsightRun.count.mockResolvedValue(0);

    const request = new NextRequest("http://localhost/api/onboarding");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toMatchObject({
      hasTransaction: false,
      hasReceipt: false,
      hasTaxRate: false,
      hasInsight: false,
      allComplete: false,
      sampleDataLoaded: false,
    });
  });

  it("GET /api/onboarding returns status with all complete", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    // Has transactions (first count for transactions, second for receipts, third for demo)
    prismaTransaction.count
      .mockResolvedValueOnce(5)   // transactions
      .mockResolvedValueOnce(1)   // receipts
      .mockResolvedValueOnce(0);  // demo transactions

    // Tax rate set
    prismaUser.findUnique.mockResolvedValue({ defaultTaxRate: "0.08625" });
    // Has insights
    prismaInsightRun.count.mockResolvedValue(1);

    const request = new NextRequest("http://localhost/api/onboarding");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toMatchObject({
      hasTransaction: true,
      hasReceipt: true,
      hasTaxRate: true,
      hasInsight: true,
      allComplete: true,
      sampleDataLoaded: false,
    });
  });

  it("GET /api/onboarding detects sample data loaded", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    prismaTransaction.count
      .mockResolvedValueOnce(20)  // transactions
      .mockResolvedValueOnce(0)   // receipts
      .mockResolvedValueOnce(15); // demo transactions (sample data loaded)

    prismaUser.findUnique.mockResolvedValue({ defaultTaxRate: null });
    prismaInsightRun.count.mockResolvedValue(1);

    const request = new NextRequest("http://localhost/api/onboarding");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.sampleDataLoaded).toBe(true);
    expect(json.hasTransaction).toBe(true);
    expect(json.hasInsight).toBe(true);
  });
});
