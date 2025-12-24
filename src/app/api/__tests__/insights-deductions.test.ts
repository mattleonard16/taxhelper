// @vitest-environment node

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
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

vi.mock("@/lib/insights/transaction-repository", () => ({
  createTransactionRepository: vi.fn(),
}));

let GET: typeof import("@/app/api/insights/deductions/route").GET;
let getAuthUserMock: ReturnType<typeof vi.fn>;
let createTransactionRepositoryMock: ReturnType<typeof vi.fn>;
let prismaUser: { findUnique: ReturnType<typeof vi.fn> };

describe("insights deductions API", () => {
  beforeAll(async () => {
    ({ GET } = await import("@/app/api/insights/deductions/route"));

    const apiUtils = await import("@/lib/api-utils");
    getAuthUserMock = vi.mocked(apiUtils.getAuthUser);

    const repoModule = await import("@/lib/insights/transaction-repository");
    createTransactionRepositoryMock = vi.mocked(repoModule.createTransactionRepository);

    const prismaModule = await import("@/lib/prisma");
    prismaUser = (prismaModule.prisma as unknown as { user: { findUnique: ReturnType<typeof vi.fn> } }).user;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getAuthUserMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/insights/deductions");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns deduction opportunities for matching transactions", async () => {
    getAuthUserMock.mockResolvedValue({ id: "user-1" });
    prismaUser.findUnique.mockResolvedValue({
      isFreelancer: true,
      worksFromHome: true,
      hasHealthInsurance: false,
    });

    const listByUserSince = vi.fn().mockResolvedValue([
      {
        id: "tx-uber-1",
        date: new Date().toISOString(),
        type: "OTHER",
        description: "Client ride",
        merchant: "Uber",
        totalAmount: "120.00",
        taxAmount: "0",
        currency: "USD",
      },
      {
        id: "tx-staples-1",
        date: new Date().toISOString(),
        type: "OTHER",
        description: "Office supplies",
        merchant: "Staples",
        totalAmount: "80.00",
        taxAmount: "0",
        currency: "USD",
      },
    ]);

    createTransactionRepositoryMock.mockReturnValue({
      listByUserSince,
      getLatestUpdatedAt: vi.fn(),
    });

    const request = new NextRequest("http://localhost/api/insights/deductions?range=365");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.deductions.length).toBeGreaterThan(0);
    expect(json.totalPotentialDeduction).toBeGreaterThan(0);
    expect(json.estimatedTaxSavings).toBeGreaterThan(0);
    expect(json.deductions[0]).toMatchObject({
      category: expect.any(String),
      potentialDeduction: expect.any(Number),
      estimatedSavings: expect.any(Number),
      transactions: expect.any(Array),
      suggestion: expect.any(String),
    });
  });
});
