// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createReceiptJobRepository } from "../receipt-job-repository";

const buildJob = (overrides: Partial<Record<string, unknown>> = {}) => ({
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
  totalAmount: "12.34",
  taxAmount: "1.23",
  items: null,
  currency: null,
  transactionId: null,
  attempts: 1,
  maxAttempts: 3,
  lastError: null,
  processedAt: null,
  processingStartedAt: null,
  createdAt: new Date("2024-03-01T00:00:00Z"),
  updatedAt: new Date("2024-03-01T00:00:00Z"),
  ...overrides,
});

describe("receipt job repository", () => {
  it("markProcessing only claims queued jobs", async () => {
    const receiptJob = {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn(),
    };
    const repository = createReceiptJobRepository({ receiptJob } as unknown as PrismaClient);

    const result = await repository.markProcessing("job-1");

    expect(result).toBeNull();
    expect(receiptJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1", status: "QUEUED" },
      })
    );
    expect(receiptJob.findUnique).not.toHaveBeenCalled();
  });

  it("markProcessing returns the claimed job", async () => {
    const job = buildJob({ status: "PROCESSING", attempts: 2 });
    const receiptJob = {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(job),
    };
    const repository = createReceiptJobRepository({ receiptJob } as unknown as PrismaClient);

    const result = await repository.markProcessing("job-1");

    expect(result?.id).toBe("job-1");
    expect(receiptJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PROCESSING",
          attempts: { increment: 1 },
          processingStartedAt: expect.any(Date),
        }),
      })
    );
  });

  it("requeueStaleJobs requeues or fails stale jobs", async () => {
    const now = new Date("2024-03-20T10:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const receiptJob = {
      findMany: vi.fn().mockResolvedValue([
        buildJob({
          id: "job-1",
          status: "PROCESSING",
          attempts: 1,
          maxAttempts: 3,
          processingStartedAt: new Date("2024-03-20T09:00:00Z"),
        }),
        buildJob({
          id: "job-2",
          status: "PROCESSING",
          attempts: 3,
          maxAttempts: 3,
          processingStartedAt: new Date("2024-03-20T09:00:00Z"),
        }),
      ]),
      update: vi.fn().mockResolvedValue(buildJob({ status: "QUEUED" })),
    };
    const repository = createReceiptJobRepository({ receiptJob } as unknown as PrismaClient);

    const result = await repository.requeueStaleJobs(30 * 60 * 1000);

    expect(result).toHaveLength(2);
    expect(receiptJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({
          status: "QUEUED",
          processingStartedAt: null,
          lastError: "Processing timed out",
        }),
      })
    );
    expect(receiptJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-2" },
        data: expect.objectContaining({
          status: "FAILED",
          processingStartedAt: null,
          lastError: "Processing timed out",
        }),
      })
    );

    vi.useRealTimers();
  });
});
