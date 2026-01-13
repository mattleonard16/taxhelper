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
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      create: vi.fn(),
      delete: vi.fn(),
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

describe("Transactions API - Priority Field", () => {
  let GET: typeof import("@/app/api/transactions/route").GET;
  let POST: typeof import("@/app/api/transactions/route").POST;
  let prismaTransaction: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  let getAuthUserMock: ReturnType<typeof vi.fn>;
  let testUser: AuthenticatedUser;

  beforeAll(async () => {
    ({ GET, POST } = await import("@/app/api/transactions/route"));
    const { prisma } = await import("@/lib/prisma");
    const { getAuthUser } = await import("@/lib/api-utils");
    prismaTransaction = prisma.transaction as unknown as typeof prismaTransaction;
    
    getAuthUserMock = vi.mocked(getAuthUser);
    testUser = {
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getAuthUserMock.mockResolvedValue(testUser);
    
    // Mock create to return the data passed to it
    prismaTransaction.create.mockImplementation((data: { data: Record<string, unknown> }) => {
      return Promise.resolve({
        id: "txn-1",
        userId: testUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data.data,
        totalAmount: data.data.totalAmount || 100,
        taxAmount: data.data.taxAmount || 10,
      });
    });
    
    prismaTransaction.findMany.mockReturnValue([]);
    prismaTransaction.count.mockReturnValue(0);
  });

  describe("POST /api/transactions", () => {
    it("should create transaction with default priority (MEDIUM)", async () => {
      const request = new NextRequest("http://localhost:3000/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          date: "2024-01-15",
          type: "OTHER",
          description: "Test transaction",
          merchant: "Test Merchant",
          totalAmount: 100,
          taxAmount: 10,
          currency: "USD",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.priority).toBe("MEDIUM");
    });

    it("should create transaction with HIGH priority", async () => {
      const request = new NextRequest("http://localhost:3000/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          date: "2024-01-15",
          type: "OTHER",
          description: "High priority transaction",
          merchant: "Important Merchant",
          totalAmount: 500,
          taxAmount: 50,
          currency: "USD",
          priority: "HIGH",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.priority).toBe("HIGH");
    });

    it("should create transaction with LOW priority", async () => {
      const request = new NextRequest("http://localhost:3000/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          date: "2024-01-15",
          type: "OTHER",
          description: "Low priority transaction",
          merchant: "Minor Merchant",
          totalAmount: 10,
          taxAmount: 1,
          currency: "USD",
          priority: "LOW",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.priority).toBe("LOW");
    });

    it("should reject invalid priority value", async () => {
      const request = new NextRequest("http://localhost:3000/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          date: "2024-01-15",
          type: "OTHER",
          description: "Test transaction",
          merchant: "Test Merchant",
          totalAmount: 100,
          taxAmount: 10,
          currency: "USD",
          priority: "INVALID",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("priority");
    });
  });

  describe("GET /api/transactions", () => {
     it("should return transactions with priority field", async () => {
       // Mock transactions with different priorities
       prismaTransaction.findMany.mockReturnValue([
         {
           id: "txn-1",
           userId: testUser.id,
           date: new Date("2024-01-15"),
           type: "OTHER",
           description: "High priority",
           merchant: "Merchant A",
           totalAmount: 100,
           taxAmount: 10,
           currency: "USD",
           priority: "HIGH",
           createdAt: new Date(),
           updatedAt: new Date(),
         },
         {
           id: "txn-2",
           userId: testUser.id,
           date: new Date("2024-01-16"),
           type: "OTHER",
           description: "Medium priority",
           merchant: "Merchant B",
           totalAmount: 50,
           taxAmount: 5,
           currency: "USD",
           priority: "MEDIUM",
           createdAt: new Date(),
           updatedAt: new Date(),
         },
         {
           id: "txn-3",
           userId: testUser.id,
           date: new Date("2024-01-17"),
           type: "OTHER",
           description: "Low priority",
           merchant: "Merchant C",
           totalAmount: 25,
           taxAmount: 2.5,
           currency: "USD",
           priority: "LOW",
           createdAt: new Date(),
           updatedAt: new Date(),
         },
       ]);
       prismaTransaction.count.mockReturnValue(3);

       const request = new NextRequest("http://localhost:3000/api/transactions", {
         method: "GET",
       });

       const response = await GET(request);
       const data = await response.json();

       expect(response.status).toBe(200);
       expect(data.transactions).toHaveLength(3);
       expect(data.transactions.every((t: { priority: string }) => t.priority)).toBe(true);

       const priorities = data.transactions.map((t: { priority: string }) => t.priority);
       expect(priorities).toContain("HIGH");
       expect(priorities).toContain("MEDIUM");
       expect(priorities).toContain("LOW");
     });

     it("should apply priority filter when provided", async () => {
       prismaTransaction.findMany.mockReturnValue([]);
       prismaTransaction.count.mockReturnValue(0);

       const request = new NextRequest("http://localhost:3000/api/transactions?priority=HIGH", {
         method: "GET",
       });

       const response = await GET(request);
       expect(response.status).toBe(200);

       expect(prismaTransaction.findMany).toHaveBeenCalledTimes(1);
       const args = prismaTransaction.findMany.mock.calls[0]?.[0] as { where?: { priority?: string } };
       expect(args.where?.priority).toBe("HIGH");
     });
   });
});
