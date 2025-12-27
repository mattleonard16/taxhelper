// @vitest-environment node

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AuthenticatedUser } from "@/lib/api-utils";

vi.mock("@/lib/receipt/receipt-jobs-service", () => ({
  patchJob: vi.fn(),
  discardJob: vi.fn(),
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

let PATCH: typeof import("@/app/api/receipts/jobs/[id]/route").PATCH;
let patchJobMock: ReturnType<typeof vi.fn>;
let getAuthUserMock: ReturnType<typeof vi.fn>;

describe("receipt jobs API routes", () => {
  beforeAll(async () => {
    ({ PATCH } = await import("@/app/api/receipts/jobs/[id]/route"));

    const serviceModule = await import("@/lib/receipt/receipt-jobs-service");
    patchJobMock = vi.mocked(serviceModule.patchJob);

    const apiUtilsModule = await import("@/lib/api-utils");
    getAuthUserMock = vi.mocked(apiUtilsModule.getAuthUser);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH /api/receipts/jobs/[id] rejects invalid totalAmount", async () => {
    const user: AuthenticatedUser = { id: "user_1" };
    getAuthUserMock.mockResolvedValue(user);

    patchJobMock.mockResolvedValue({ success: true, data: {} } as never);

    const request = new NextRequest("http://localhost/api/receipts/jobs/job_1", {
      method: "PATCH",
      body: JSON.stringify({ totalAmount: "not-a-number" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "job_1" }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Invalid totalAmount" });
    expect(patchJobMock).not.toHaveBeenCalled();
  });
});
