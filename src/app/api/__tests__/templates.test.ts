// @vitest-environment node

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AuthenticatedUser } from "@/lib/api-utils";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taxTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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

let GET: typeof import("@/app/api/templates/route").GET;
let POST: typeof import("@/app/api/templates/route").POST;
let PUT: typeof import("@/app/api/templates/[id]/route").PUT;
let DELETE: typeof import("@/app/api/templates/[id]/route").DELETE;
let prismaTaxTemplate: {
  findMany: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
let getAuthUserMock: ReturnType<typeof vi.fn>;

describe("templates API routes", () => {
  beforeAll(async () => {
    ({ GET, POST } = await import("@/app/api/templates/route"));
    ({ PUT, DELETE } = await import("@/app/api/templates/[id]/route"));

    const prismaModule = await import("@/lib/prisma");
    prismaTaxTemplate = (prismaModule.prisma as unknown as { taxTemplate: unknown }).taxTemplate as typeof prismaTaxTemplate;

    const apiUtilsModule = await import("@/lib/api-utils");
    getAuthUserMock = vi.mocked(apiUtilsModule.getAuthUser);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/templates", () => {
    it("returns 401 without session", async () => {
      getAuthUserMock.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/templates");
      const response = await GET(request);

      expect(response.status).toBe(401);
      expect(response.headers.get("X-Request-Id")).toBeTruthy();

      const json = await response.json();
      expect(json).toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("returns templates for authenticated user", async () => {
      const user: AuthenticatedUser = { id: "user_1" };
      getAuthUserMock.mockResolvedValue(user);

      prismaTaxTemplate.findMany.mockResolvedValue([
        {
          id: "tpl_1",
          userId: user.id,
          label: "NYC Sales Tax",
          merchant: null,
          taxRate: "0.08875",
          type: "SALES_TAX",
          isDefault: true,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
        {
          id: "tpl_2",
          userId: user.id,
          label: "Amazon",
          merchant: "Amazon",
          taxRate: "0.0725",
          type: "SALES_TAX",
          isDefault: false,
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
        },
      ]);

      const request = new NextRequest("http://localhost/api/templates");
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prismaTaxTemplate.findMany).toHaveBeenCalledWith({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });

      const json = await response.json();
      expect(json.templates).toHaveLength(2);
      expect(json.templates[0].taxRate).toBe("0.08875");
    });
  });

  describe("POST /api/templates", () => {
    it("creates template with valid data", async () => {
      const user: AuthenticatedUser = { id: "user_1" };
      getAuthUserMock.mockResolvedValue(user);

      prismaTaxTemplate.create.mockResolvedValue({
        id: "tpl_new",
        userId: user.id,
        label: "State Tax",
        merchant: null,
        taxRate: "0.06",
        type: "SALES_TAX",
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest("http://localhost/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "State Tax",
          taxRate: 0.06,
          type: "SALES_TAX",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      expect(prismaTaxTemplate.create).toHaveBeenCalledTimes(1);
      const createArgs = prismaTaxTemplate.create.mock.calls[0][0];
      expect(createArgs.data.userId).toBe(user.id);
      expect(createArgs.data.label).toBe("State Tax");
      expect(createArgs.data.taxRate).toBe(0.06);
    });

    it("unsets other defaults when setting isDefault", async () => {
      const user: AuthenticatedUser = { id: "user_1" };
      getAuthUserMock.mockResolvedValue(user);

      prismaTaxTemplate.updateMany.mockResolvedValue({ count: 1 });
      prismaTaxTemplate.create.mockResolvedValue({
        id: "tpl_new",
        userId: user.id,
        label: "Default Tax",
        merchant: null,
        taxRate: "0.08",
        type: "SALES_TAX",
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest("http://localhost/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Default Tax",
          taxRate: 0.08,
          type: "SALES_TAX",
          isDefault: true,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      expect(prismaTaxTemplate.updateMany).toHaveBeenCalledWith({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    });

    it("rejects invalid type", async () => {
      const user: AuthenticatedUser = { id: "user_1" };
      getAuthUserMock.mockResolvedValue(user);

      const request = new NextRequest("http://localhost/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Bad Template",
          taxRate: 0.08,
          type: "INVALID_TYPE",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      expect(prismaTaxTemplate.create).not.toHaveBeenCalled();
    });

    it("rejects missing required fields", async () => {
      const user: AuthenticatedUser = { id: "user_1" };
      getAuthUserMock.mockResolvedValue(user);

      const request = new NextRequest("http://localhost/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxRate: 0.08,
          type: "SALES_TAX",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      expect(prismaTaxTemplate.create).not.toHaveBeenCalled();
    });
  });

  describe("PUT /api/templates/[id]", () => {
    it("returns 404 for non-existent template", async () => {
      const user: AuthenticatedUser = { id: "user_1" };
      getAuthUserMock.mockResolvedValue(user);

      prismaTaxTemplate.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/templates/tpl_nonexistent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Updated" }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: "tpl_nonexistent" }) });
      expect(response.status).toBe(404);
    });

    it("updates template with valid data", async () => {
      const user: AuthenticatedUser = { id: "user_1" };
      getAuthUserMock.mockResolvedValue(user);

      prismaTaxTemplate.findFirst.mockResolvedValue({
        id: "tpl_1",
        userId: user.id,
        label: "Old Label",
        merchant: null,
        taxRate: "0.08",
        type: "SALES_TAX",
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prismaTaxTemplate.update.mockResolvedValue({
        id: "tpl_1",
        userId: user.id,
        label: "New Label",
        merchant: "Target",
        taxRate: "0.09",
        type: "SALES_TAX",
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest("http://localhost/api/templates/tpl_1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "New Label",
          merchant: "Target",
          taxRate: 0.09,
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: "tpl_1" }) });
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.label).toBe("New Label");
      expect(json.taxRate).toBe("0.09");
    });

    it("prevents updating another user's template", async () => {
      const user: AuthenticatedUser = { id: "user_1" };
      getAuthUserMock.mockResolvedValue(user);

      // findFirst with userId filter returns null (template belongs to different user)
      prismaTaxTemplate.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/templates/tpl_other", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Hacked" }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: "tpl_other" }) });
      expect(response.status).toBe(404);
      expect(prismaTaxTemplate.update).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/templates/[id]", () => {
    it("returns 401 without session", async () => {
      getAuthUserMock.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/templates/tpl_1", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: "tpl_1" }) });
      expect(response.status).toBe(401);
    });

    it("returns 404 for non-existent template", async () => {
      const user: AuthenticatedUser = { id: "user_1" };
      getAuthUserMock.mockResolvedValue(user);

      prismaTaxTemplate.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/templates/tpl_nonexistent", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: "tpl_nonexistent" }) });
      expect(response.status).toBe(404);
    });

    it("deletes template successfully", async () => {
      const user: AuthenticatedUser = { id: "user_1" };
      getAuthUserMock.mockResolvedValue(user);

      prismaTaxTemplate.findFirst.mockResolvedValue({
        id: "tpl_1",
        userId: user.id,
        label: "To Delete",
        merchant: null,
        taxRate: "0.08",
        type: "SALES_TAX",
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prismaTaxTemplate.delete.mockResolvedValue({});

      const request = new NextRequest("http://localhost/api/templates/tpl_1", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: "tpl_1" }) });
      expect(response.status).toBe(200);

      expect(prismaTaxTemplate.delete).toHaveBeenCalledWith({ where: { id: "tpl_1" } });

      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it("prevents deleting another user's template", async () => {
      const user: AuthenticatedUser = { id: "user_1" };
      getAuthUserMock.mockResolvedValue(user);

      prismaTaxTemplate.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/templates/tpl_other", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: "tpl_other" }) });
      expect(response.status).toBe(404);
      expect(prismaTaxTemplate.delete).not.toHaveBeenCalled();
    });
  });
});
