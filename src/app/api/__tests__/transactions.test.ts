// @vitest-environment node

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AuthenticatedUser } from "@/lib/api-utils";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
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

let GET: typeof import("@/app/api/transactions/route").GET;
let POST: typeof import("@/app/api/transactions/route").POST;
let prismaTransaction: {
  findMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};
let getAuthUserMock: ReturnType<typeof vi.fn>;

describe("transactions API routes", () => {
  beforeAll(async () => {
    ({ GET, POST } = await import("@/app/api/transactions/route"));

    const prismaModule = await import("@/lib/prisma");
    prismaTransaction = (prismaModule.prisma as unknown as { transaction: unknown }).transaction as typeof prismaTransaction;

    const apiUtilsModule = await import("@/lib/api-utils");
    getAuthUserMock = vi.mocked(apiUtilsModule.getAuthUser);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/transactions returns 401 without session", async () => {
    getAuthUserMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/transactions");
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(response.headers.get("X-Request-Id")).toBeTruthy();

    const json = await response.json();
    expect(json).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("GET /api/transactions applies date range and pagination", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    prismaTransaction.findMany.mockResolvedValue([
      {
        id: "tx_1",
        userId: user.id,
        date: new Date("2024-01-15T12:00:00"),
        type: "SALES_TAX",
        description: null,
        merchant: "Amazon",
        totalAmount: "100.00",
        taxAmount: "8.00",
        currency: "USD",
        createdAt: new Date("2024-01-15T12:00:00"),
        updatedAt: new Date("2024-01-15T12:00:00"),
      },
    ]);
    prismaTransaction.count.mockResolvedValue(1);

    const request = new NextRequest(
      "http://localhost/api/transactions?from=2024-01-01&to=2024-01-31&type=SALES_TAX&page=2&limit=20"
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    expect(prismaTransaction.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prismaTransaction.findMany.mock.calls[0][0];
    expect(findManyArgs.skip).toBe(20);
    expect(findManyArgs.take).toBe(20);
    expect(findManyArgs.where.userId).toBe(user.id);
    expect(findManyArgs.where.type).toBe("SALES_TAX");
    expect(findManyArgs.where.date).toMatchObject({
      gte: expect.any(Date),
      lte: expect.any(Date),
    });

    const json = await response.json();
    expect(json.pagination).toMatchObject({ page: 2, limit: 20, total: 1, pages: 1 });
    expect(json.transactions).toHaveLength(1);
  });

  it("GET /api/transactions supports fetching by explicit ids", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    prismaTransaction.findMany.mockResolvedValue([
      {
        id: "tx_1",
        userId: user.id,
        date: new Date("2024-01-15T12:00:00"),
        type: "SALES_TAX",
        description: null,
        merchant: "Amazon",
        totalAmount: "100.00",
        taxAmount: "8.00",
        currency: "USD",
        createdAt: new Date("2024-01-15T12:00:00"),
        updatedAt: new Date("2024-01-15T12:00:00"),
      },
      {
        id: "tx_2",
        userId: user.id,
        date: new Date("2024-01-16T12:00:00"),
        type: "SALES_TAX",
        description: null,
        merchant: "Target",
        totalAmount: "50.00",
        taxAmount: "4.00",
        currency: "USD",
        createdAt: new Date("2024-01-16T12:00:00"),
        updatedAt: new Date("2024-01-16T12:00:00"),
      },
    ]);

    const request = new NextRequest("http://localhost/api/transactions?ids=tx_1,tx_2,tx_1");
    const response = await GET(request);
    expect(response.status).toBe(200);

    expect(prismaTransaction.findMany).toHaveBeenCalledTimes(1);
    expect(prismaTransaction.count).not.toHaveBeenCalled();

    const findManyArgs = prismaTransaction.findMany.mock.calls[0][0];
    expect(findManyArgs.where.userId).toBe(user.id);
    expect(findManyArgs.where.id).toEqual({ in: ["tx_1", "tx_2"] });

    const json = await response.json();
    expect(json.transactions).toHaveLength(2);
    expect(json.pagination).toMatchObject({ page: 1, limit: 2, total: 2, pages: 1 });
  });

  it("POST /api/transactions creates transaction with YYYY-MM-DD date", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    prismaTransaction.create.mockImplementation(async ({ data }: { data: { date: Date } }) => ({
      id: "tx_new",
      userId: user.id,
      date: data.date,
      type: "SALES_TAX",
      description: null,
      merchant: "Target",
      totalAmount: "100.00",
      taxAmount: "8.00",
      currency: "USD",
      createdAt: new Date("2024-01-15T12:00:00"),
      updatedAt: new Date("2024-01-15T12:00:00"),
    }));

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2024-01-15",
        type: "SALES_TAX",
        totalAmount: 100,
        taxAmount: 8,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    expect(prismaTransaction.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaTransaction.create.mock.calls[0][0];
    expect(createArgs.data.userId).toBe(user.id);
    expect(createArgs.data.date).toBeInstanceOf(Date);
    expect((createArgs.data.date as Date).getHours()).toBe(12);
  });

  it("POST /api/transactions rejects invalid type", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2024-01-15",
        type: "INVALID",
        totalAmount: 100,
        taxAmount: 8,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(prismaTransaction.create).not.toHaveBeenCalled();
  });

  it("GET /api/transactions applies search filter to merchant and description", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    prismaTransaction.findMany.mockResolvedValue([]);
    prismaTransaction.count.mockResolvedValue(0);

    const request = new NextRequest(
      "http://localhost/api/transactions?search=Starbucks"
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    expect(prismaTransaction.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prismaTransaction.findMany.mock.calls[0][0];

    // Should have OR condition for merchant and description
    expect(findManyArgs.where.OR).toBeDefined();
    expect(findManyArgs.where.OR).toHaveLength(2);
    expect(findManyArgs.where.OR[0].merchant).toEqual({ contains: "Starbucks", mode: "insensitive" });
    expect(findManyArgs.where.OR[1].description).toEqual({ contains: "Starbucks", mode: "insensitive" });
  });

  it("GET /api/transactions applies minAmount filter", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    prismaTransaction.findMany.mockResolvedValue([]);
    prismaTransaction.count.mockResolvedValue(0);

    const request = new NextRequest(
      "http://localhost/api/transactions?minAmount=50"
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    expect(prismaTransaction.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prismaTransaction.findMany.mock.calls[0][0];

    expect(findManyArgs.where.totalAmount).toEqual({ gte: 50 });
  });

  it("GET /api/transactions applies maxAmount filter", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    prismaTransaction.findMany.mockResolvedValue([]);
    prismaTransaction.count.mockResolvedValue(0);

    const request = new NextRequest(
      "http://localhost/api/transactions?maxAmount=100"
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    expect(prismaTransaction.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prismaTransaction.findMany.mock.calls[0][0];

    expect(findManyArgs.where.totalAmount).toEqual({ lte: 100 });
  });

  it("GET /api/transactions combines minAmount and maxAmount filters", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    prismaTransaction.findMany.mockResolvedValue([]);
    prismaTransaction.count.mockResolvedValue(0);

    const request = new NextRequest(
      "http://localhost/api/transactions?minAmount=50&maxAmount=200"
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    expect(prismaTransaction.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prismaTransaction.findMany.mock.calls[0][0];

    expect(findManyArgs.where.totalAmount).toEqual({ gte: 50, lte: 200 });
  });
});
