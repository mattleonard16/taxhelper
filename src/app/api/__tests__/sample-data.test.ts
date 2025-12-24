// @vitest-environment node

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AuthenticatedUser } from "@/lib/api-utils";
import { DEMO_PREFIX } from "@/lib/sample-data";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      count: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
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

// Mock insights module to avoid database calls
vi.mock("@/lib/insights", () => ({
  getInsights: vi.fn(async () => []),
}));

let POST: typeof import("@/app/api/sample-data/route").POST;
let DELETE: typeof import("@/app/api/sample-data/route").DELETE;
let prismaTransaction: {
  count: ReturnType<typeof vi.fn>;
  createMany: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
};
let getAuthUserMock: ReturnType<typeof vi.fn>;

describe("sample-data API route", () => {
  beforeAll(async () => {
    ({ POST, DELETE } = await import("@/app/api/sample-data/route"));

    const prismaModule = await import("@/lib/prisma");
    prismaTransaction = (prismaModule.prisma as unknown as { transaction: unknown })
      .transaction as typeof prismaTransaction;

    const apiUtilsModule = await import("@/lib/api-utils");
    getAuthUserMock = vi.mocked(apiUtilsModule.getAuthUser);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/sample-data returns 401 without session", async () => {
    getAuthUserMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/sample-data", {
      method: "POST",
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("POST /api/sample-data creates transactions when none exist", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    // No existing demo transactions
    prismaTransaction.count.mockResolvedValue(0);
    // Mock successful creation
    prismaTransaction.createMany.mockResolvedValue({ count: 20 });

    const request = new NextRequest("http://localhost/api/sample-data", {
      method: "POST",
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toMatchObject({
      success: true,
      message: "Sample data loaded successfully",
      created: 20,
    });

    // Verify createMany was called
    expect(prismaTransaction.createMany).toHaveBeenCalledTimes(1);
    const createArgs = prismaTransaction.createMany.mock.calls[0][0];

    // All descriptions should start with DEMO_PREFIX
    expect(createArgs.data.every((tx: { description: string }) =>
      tx.description.startsWith(DEMO_PREFIX)
    )).toBe(true);

    // All should have the user ID
    expect(createArgs.data.every((tx: { userId: string }) =>
      tx.userId === user.id
    )).toBe(true);
  });

  it("POST /api/sample-data is idempotent - skips if data exists", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    // Existing demo transactions
    prismaTransaction.count.mockResolvedValue(15);

    const request = new NextRequest("http://localhost/api/sample-data", {
      method: "POST",
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toMatchObject({
      success: true,
      message: "Sample data already loaded",
      created: 0,
      alreadyExisted: 15,
    });

    // Should NOT call createMany
    expect(prismaTransaction.createMany).not.toHaveBeenCalled();
  });

  it("DELETE /api/sample-data returns 401 without session", async () => {
    getAuthUserMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/sample-data", {
      method: "DELETE",
    });
    const response = await DELETE(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("DELETE /api/sample-data deletes demo transactions and returns count", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    // Mock successful deletion of 15 transactions
    prismaTransaction.deleteMany.mockResolvedValue({ count: 15 });

    const request = new NextRequest("http://localhost/api/sample-data", {
      method: "DELETE",
    });
    const response = await DELETE(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toMatchObject({
      success: true,
      message: "Removed 15 sample transactions",
      deleted: 15,
    });

    // Verify deleteMany was called with correct filter
    expect(prismaTransaction.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaTransaction.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        description: { startsWith: DEMO_PREFIX },
      },
    });
  });

  it("DELETE /api/sample-data returns 0 if no demo data exists", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    // No demo transactions to delete
    prismaTransaction.deleteMany.mockResolvedValue({ count: 0 });

    const request = new NextRequest("http://localhost/api/sample-data", {
      method: "DELETE",
    });
    const response = await DELETE(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toMatchObject({
      success: true,
      message: "No sample data to remove",
      deleted: 0,
    });
  });
});
