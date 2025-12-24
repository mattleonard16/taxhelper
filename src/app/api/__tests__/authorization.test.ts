// @vitest-environment node
/**
 * Authorization Security Tests
 * Verifies that cross-user data access is blocked across all API routes.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AuthenticatedUser } from "@/lib/api-utils";

// User fixtures for cross-user testing
const USER_A: AuthenticatedUser = { id: "user_a", email: "a@test.com" };
const USER_B: AuthenticatedUser = { id: "user_b", email: "b@test.com" };

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    taxTemplate: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    recurringTransaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    insight: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    insightRun: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock rate limiter to always allow
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

// Mock auth user
vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

// Import handlers
let transactionIdRoute: typeof import("@/app/api/transactions/[id]/route");
let templateIdRoute: typeof import("@/app/api/templates/[id]/route");
let recurringIdRoute: typeof import("@/app/api/recurring/[id]/route");
let insightIdRoute: typeof import("@/app/api/insights/[id]/route");

// Mock objects
let prisma: {
  transaction: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  taxTemplate: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  recurringTransaction: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  insight: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  insightRun: { findFirst: ReturnType<typeof vi.fn> };
};
let getAuthUserMock: ReturnType<typeof vi.fn>;

describe("Authorization Security Tests", () => {
  beforeAll(async () => {
    // Import routes
    transactionIdRoute = await import("@/app/api/transactions/[id]/route");
    templateIdRoute = await import("@/app/api/templates/[id]/route");
    recurringIdRoute = await import("@/app/api/recurring/[id]/route");
    insightIdRoute = await import("@/app/api/insights/[id]/route");

    // Get mocks
    const prismaModule = await import("@/lib/prisma");
    prisma = prismaModule.prisma as unknown as typeof prisma;

    const apiUtilsModule = await import("@/lib/api-utils");
    getAuthUserMock = vi.mocked(apiUtilsModule.getAuthUser);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Transaction [id] routes - cross-user protection", () => {
    it("GET /api/transactions/[id] returns 404 for another user's transaction", async () => {
      // User B is authenticated but trying to access User A's transaction
      getAuthUserMock.mockResolvedValue(USER_B);
      
      // Transaction belongs to User A - findFirst with userId check returns null
      prisma.transaction.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/transactions/tx_belongs_to_user_a");
      const response = await transactionIdRoute.GET(request, { params: Promise.resolve({ id: "tx_belongs_to_user_a" }) });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json).toMatchObject({ code: "NOT_FOUND" });

      // Verify the query included userId constraint
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: "tx_belongs_to_user_a", userId: USER_B.id },
      });
    });

    it("PUT /api/transactions/[id] returns 404 for another user's transaction", async () => {
      getAuthUserMock.mockResolvedValue(USER_B);
      prisma.transaction.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/transactions/tx_belongs_to_user_a", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Malicious update" }),
      });
      const response = await transactionIdRoute.PUT(request, { params: Promise.resolve({ id: "tx_belongs_to_user_a" }) });

      expect(response.status).toBe(404);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it("DELETE /api/transactions/[id] returns 404 for another user's transaction", async () => {
      getAuthUserMock.mockResolvedValue(USER_B);
      prisma.transaction.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/transactions/tx_belongs_to_user_a", {
        method: "DELETE",
      });
      const response = await transactionIdRoute.DELETE(request, { params: Promise.resolve({ id: "tx_belongs_to_user_a" }) });

      expect(response.status).toBe(404);
      expect(prisma.transaction.delete).not.toHaveBeenCalled();
    });
  });

  describe("Template [id] routes - cross-user protection", () => {
    it("PUT /api/templates/[id] returns 404 for another user's template", async () => {
      getAuthUserMock.mockResolvedValue(USER_B);
      prisma.taxTemplate.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/templates/tpl_belongs_to_user_a", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Malicious update" }),
      });
      const response = await templateIdRoute.PUT(request, { params: Promise.resolve({ id: "tpl_belongs_to_user_a" }) });

      expect(response.status).toBe(404);
      expect(prisma.taxTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: "tpl_belongs_to_user_a", userId: USER_B.id },
      });
      expect(prisma.taxTemplate.update).not.toHaveBeenCalled();
    });

    it("DELETE /api/templates/[id] returns 404 for another user's template", async () => {
      getAuthUserMock.mockResolvedValue(USER_B);
      prisma.taxTemplate.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/templates/tpl_belongs_to_user_a", {
        method: "DELETE",
      });
      const response = await templateIdRoute.DELETE(request, { params: Promise.resolve({ id: "tpl_belongs_to_user_a" }) });

      expect(response.status).toBe(404);
      expect(prisma.taxTemplate.delete).not.toHaveBeenCalled();
    });
  });

  describe("Recurring [id] routes - cross-user protection", () => {
    it("GET /api/recurring/[id] returns 404 for another user's recurring transaction", async () => {
      getAuthUserMock.mockResolvedValue(USER_B);
      // The route uses findUnique with compound userId check
      prisma.recurringTransaction.findUnique.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/recurring/rec_belongs_to_user_a");
      const response = await recurringIdRoute.GET(request, { params: Promise.resolve({ id: "rec_belongs_to_user_a" }) });

      expect(response.status).toBe(404);
      expect(prisma.recurringTransaction.findUnique).toHaveBeenCalledWith({
        where: { id: "rec_belongs_to_user_a", userId: USER_B.id },
      });
    });

    it("PUT /api/recurring/[id] returns 403 for another user's recurring transaction", async () => {
      getAuthUserMock.mockResolvedValue(USER_B);
      // First findUnique returns the record, then ownership check fails
      prisma.recurringTransaction.findUnique.mockResolvedValue({
        id: "rec_belongs_to_user_a",
        userId: USER_A.id, // Different user!
      });

      const request = new NextRequest("http://localhost/api/recurring/rec_belongs_to_user_a", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Malicious update" }),
      });
      const response = await recurringIdRoute.PUT(request, { params: Promise.resolve({ id: "rec_belongs_to_user_a" }) });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json).toMatchObject({ code: "FORBIDDEN" });
      expect(prisma.recurringTransaction.update).not.toHaveBeenCalled();
    });

    it("DELETE /api/recurring/[id] returns 403 for another user's recurring transaction", async () => {
      getAuthUserMock.mockResolvedValue(USER_B);
      prisma.recurringTransaction.findUnique.mockResolvedValue({
        id: "rec_belongs_to_user_a",
        userId: USER_A.id,
      });

      const request = new NextRequest("http://localhost/api/recurring/rec_belongs_to_user_a", {
        method: "DELETE",
      });
      const response = await recurringIdRoute.DELETE(request, { params: Promise.resolve({ id: "rec_belongs_to_user_a" }) });

      expect(response.status).toBe(403);
      expect(prisma.recurringTransaction.delete).not.toHaveBeenCalled();
    });
  });

  describe("Insight [id] routes - cross-user protection", () => {
    it("PATCH /api/insights/[id] returns 404 for another user's insight", async () => {
      getAuthUserMock.mockResolvedValue(USER_B);
      // Mock insight repository - findFirst with run.userId check returns null
      prisma.insight.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/insights/ins_belongs_to_user_a", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
      const response = await insightIdRoute.PATCH(request, { params: Promise.resolve({ id: "ins_belongs_to_user_a" }) });

      expect(response.status).toBe(404);
      expect(prisma.insight.update).not.toHaveBeenCalled();
    });
  });

  describe("All routes require authentication", () => {
    it("returns 401 for unauthenticated requests to transaction routes", async () => {
      getAuthUserMock.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/transactions/tx_1");
      const response = await transactionIdRoute.GET(request, { params: Promise.resolve({ id: "tx_1" }) });

      expect(response.status).toBe(401);
    });

    it("returns 401 for unauthenticated requests to template routes", async () => {
      getAuthUserMock.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/templates/tpl_1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Test" }),
      });
      const response = await templateIdRoute.PUT(request, { params: Promise.resolve({ id: "tpl_1" }) });

      expect(response.status).toBe(401);
    });

    it("returns 401 for unauthenticated requests to recurring routes", async () => {
      getAuthUserMock.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/recurring/rec_1");
      const response = await recurringIdRoute.GET(request, { params: Promise.resolve({ id: "rec_1" }) });

      expect(response.status).toBe(401);
    });

    it("returns 401 for unauthenticated requests to insight routes", async () => {
      getAuthUserMock.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/insights/ins_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
      const response = await insightIdRoute.PATCH(request, { params: Promise.resolve({ id: "ins_1" }) });

      expect(response.status).toBe(401);
    });
  });
});
