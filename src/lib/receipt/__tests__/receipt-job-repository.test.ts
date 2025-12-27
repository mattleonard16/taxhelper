// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { createReceiptJobRepository } from "../receipt-job-repository";

const buildJob = (overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  userId: "user-1",
  status: "QUEUED",
  originalName: "receipt.jpg",
  mimeType: "image/jpeg",
  fileSize: 1200,
  storagePath: "receipts/user-1/OTHER/test.jpg",
  ocrText: null,
  ocrConfidence: null,
  merchant: null,
  date: null,
  totalAmount: null,
  taxAmount: null,
  items: null,
  currency: "USD",
  category: null,
  categoryCode: null,
  isDeductible: false,
  extractionConfidence: null,
  transactionId: null,
  attempts: 0,
  maxAttempts: 3,
  lastError: null,
  processedAt: null,
  processingStartedAt: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  discardedAt: null,
  ...overrides,
});

describe("receipt-job-repository", () => {
  it("findPendingJobs excludes discarded jobs", async () => {
    const activeJob = buildJob({ id: "active" });
    const discardedJob = buildJob({ id: "discarded", discardedAt: new Date("2024-01-02T00:00:00Z") });

    const findMany = vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where.discardedAt === null) {
        return Promise.resolve([activeJob]);
      }
      return Promise.resolve([activeJob, discardedJob]);
    });

    const repository = createReceiptJobRepository({
      receiptJob: {
        findMany,
      },
    } as never);

    const result = await repository.findPendingJobs();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "QUEUED",
          discardedAt: null,
        }),
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("active");
  });
});
