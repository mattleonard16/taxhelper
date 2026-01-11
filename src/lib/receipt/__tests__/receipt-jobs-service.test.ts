// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Prisma before importing service
vi.mock("@/lib/prisma", () => ({
  prisma: {
    receiptJob: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
    receiptCorrection: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  confirmJob,
  patchJob,
  retryJob,
  discardJob,
  listInbox,
  recoverStuckConfirmations,
  determineStatusFromConfidence,
  CONFIDENCE_THRESHOLD,
} from "../receipt-jobs-service";

const buildJob = (overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  userId: "user-1",
  status: "COMPLETED",
  originalName: "receipt.jpg",
  mimeType: "image/jpeg",
  fileSize: 1200,
  storagePath: "receipts/user-1/OTHER/test.jpg",
  ocrText: null,
  ocrConfidence: null,
  merchant: "Test Store",
  date: new Date("2024-03-01"),
  totalAmount: { toNumber: () => 12.34, toString: () => "12.34" },
  taxAmount: { toNumber: () => 1.23, toString: () => "1.23" },
  items: null,
  currency: "USD",
  category: "Meals",
  categoryCode: "MEALS",
  isDeductible: false,
  extractionConfidence: 0.85,
  transactionId: null,
  attempts: 1,
  maxAttempts: 3,
  lastError: null,
  processedAt: new Date(),
  processingStartedAt: null,
  createdAt: new Date("2024-03-01T00:00:00Z"),
  updatedAt: new Date("2024-03-01T00:00:00Z"),
  ...overrides,
});

describe("receipt-jobs-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("determineStatusFromConfidence", () => {
    it("returns NEEDS_REVIEW for null confidence", () => {
      expect(determineStatusFromConfidence(null)).toBe("NEEDS_REVIEW");
    });

    it("returns NEEDS_REVIEW for low confidence", () => {
      expect(determineStatusFromConfidence(0.5)).toBe("NEEDS_REVIEW");
      expect(determineStatusFromConfidence(CONFIDENCE_THRESHOLD - 0.01)).toBe("NEEDS_REVIEW");
    });

    it("returns COMPLETED for high confidence", () => {
      expect(determineStatusFromConfidence(CONFIDENCE_THRESHOLD)).toBe("COMPLETED");
      expect(determineStatusFromConfidence(0.95)).toBe("COMPLETED");
    });
  });

  describe("confirmJob", () => {
    it("creates transaction and sets status to CONFIRMED", async () => {
      const job = buildJob({ status: "COMPLETED" });
      const createdTransaction = { id: "txn-123" };
      const findUniqueMock = vi.fn().mockResolvedValue(job);

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          receiptJob: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: findUniqueMock,
            update: vi.fn().mockResolvedValue({ ...job, status: "CONFIRMED", transactionId: "txn-123" }),
          },
          transaction: {
            create: vi.fn().mockResolvedValue(createdTransaction),
          },
        };
        return fn(tx as never);
      });

      const result = await confirmJob("user-1", "job-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transactionId).toBe("txn-123");
      }
    });

    it("uses latest job data inside the transaction after claim", async () => {
      const job = buildJob({ status: "COMPLETED", merchant: "Old Merchant" });
      const refreshedJob = buildJob({ status: "COMPLETED", merchant: "New Merchant" });
      const createdTransaction = { id: "txn-789" };
      const findUniqueMock = vi.fn().mockResolvedValue(refreshedJob);
      const createMock = vi.fn().mockResolvedValue(createdTransaction);

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          receiptJob: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: findUniqueMock,
            update: vi.fn().mockResolvedValue({ ...refreshedJob, status: "CONFIRMED", transactionId: "txn-789" }),
          },
          transaction: {
            create: createMock,
          },
        };
        return fn(tx as never);
      });

      await confirmJob("user-1", "job-1");

      expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: "job-1" } });
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ merchant: "New Merchant" }),
        })
      );
    });

    it("is idempotent - returns existing transactionId if already CONFIRMED", async () => {
      const confirmedJob = buildJob({
        status: "CONFIRMED",
        transactionId: "existing-txn",
      });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(confirmedJob as never);

      const result = await confirmJob("user-1", "job-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transactionId).toBe("existing-txn");
      }
      // Should not attempt to create transaction
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects confirm for QUEUED status", async () => {
      const queuedJob = buildJob({ status: "QUEUED" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(queuedJob as never);

      const result = await confirmJob("user-1", "job-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_STATUS");
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects confirm for PROCESSING status", async () => {
      const processingJob = buildJob({ status: "PROCESSING" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(processingJob as never);

      const result = await confirmJob("user-1", "job-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_STATUS");
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects confirm for FAILED status", async () => {
      const failedJob = buildJob({ status: "FAILED" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(failedJob as never);

      const result = await confirmJob("user-1", "job-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_STATUS");
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects confirm when required fields are missing", async () => {
      const incompleteJob = buildJob({
        status: "NEEDS_REVIEW",
        merchant: null,
        totalAmount: null,
        date: null,
      });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(incompleteJob as never);

      const result = await confirmJob("user-1", "job-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.error).toContain("merchant");
        expect(result.error).toContain("totalAmount");
        expect(result.error).toContain("date");
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("allows confirm for NEEDS_REVIEW with complete fields", async () => {
      const needsReviewJob = buildJob({ status: "NEEDS_REVIEW" });
      const createdTransaction = { id: "txn-456" };
      const findUniqueMock = vi.fn().mockResolvedValue(needsReviewJob);

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(needsReviewJob as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          receiptJob: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: findUniqueMock,
            update: vi.fn().mockResolvedValue({ ...needsReviewJob, status: "CONFIRMED", transactionId: "txn-456" }),
          },
          transaction: {
            create: vi.fn().mockResolvedValue(createdTransaction),
          },
        };
        return fn(tx as never);
      });

      const result = await confirmJob("user-1", "job-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transactionId).toBe("txn-456");
      }
    });

    it("returns NOT_FOUND for non-existent job", async () => {
      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(null);

      const result = await confirmJob("user-1", "non-existent");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("NOT_FOUND");
      }
    });

    it("returns winner transactionId when claim fails due to race condition", async () => {
      const job = buildJob({ status: "COMPLETED" });

      vi.mocked(prisma.receiptJob.findFirst)
        .mockResolvedValueOnce(job as never) // First fetch
        .mockResolvedValueOnce({ ...job, status: "CONFIRMED", transactionId: "winner-txn" } as never); // Re-fetch after failed claim
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          receiptJob: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            update: vi.fn(),
          },
          transaction: {
            create: vi.fn(),
          },
        };
        return fn(tx as never);
      });

      const result = await confirmJob("user-1", "job-1");

      // Should return the existing transactionId from the winner
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transactionId).toBe("winner-txn");
      }
    });

    it("does not create orphan transaction when claim fails - transaction.create never called", async () => {
      const job = buildJob({ status: "COMPLETED" });
      const txCreateMock = vi.fn();

      vi.mocked(prisma.receiptJob.findFirst)
        .mockResolvedValueOnce(job as never)
        .mockResolvedValueOnce({ ...job, status: "CONFIRMED", transactionId: "winner-txn" } as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          receiptJob: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Claim fails
            update: vi.fn(),
          },
          transaction: {
            create: txCreateMock,
          },
        };
        return fn(tx as never);
      });

      await confirmJob("user-1", "job-1");

      // Transaction.create should never be called because claim failed first
      expect(txCreateMock).not.toHaveBeenCalled();
    });

    it("atomic transaction ensures no orphan on partial failure", async () => {
      const job = buildJob({ status: "COMPLETED" });
      const findUniqueMock = vi.fn().mockResolvedValue(job);

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          receiptJob: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }), // Claim succeeds
            findUnique: findUniqueMock,
            update: vi.fn(),
          },
          transaction: {
            create: vi.fn().mockRejectedValue(new Error("DB error")), // Transaction creation fails
          },
        };
        // The whole $transaction should roll back
        return fn(tx as never);
      });

      await expect(confirmJob("user-1", "job-1")).rejects.toThrow("DB error");
      // If transaction.create fails, the whole $transaction rolls back
      // so the claim (updateMany) is also rolled back - no orphan state
    });

    it("idempotent when called with transactionId already set (regardless of status check)", async () => {
      // Edge case: job has transactionId but we still check it
      const jobWithTxn = buildJob({
        status: "CONFIRMED",
        transactionId: "existing-txn-123",
      });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(jobWithTxn as never);

      const result = await confirmJob("user-1", "job-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transactionId).toBe("existing-txn-123");
      }
      // No new transaction should be created
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("returns CONFLICT when claim fails and no winner transactionId found", async () => {
      const job = buildJob({ status: "COMPLETED" });

      vi.mocked(prisma.receiptJob.findFirst)
        .mockResolvedValueOnce(job as never)
        .mockResolvedValueOnce({ ...job, status: "CONFIRMED", transactionId: null } as never); // Stuck state
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          receiptJob: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            update: vi.fn(),
          },
          transaction: {
            create: vi.fn(),
          },
        };
        return fn(tx as never);
      });

      const result = await confirmJob("user-1", "job-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("CONFLICT");
      }
    });
  });

  describe("recoverStuckConfirmations", () => {
    it("resets stale confirmed jobs missing transactionId", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:10:00Z"));

      vi.mocked(prisma.receiptJob.updateMany).mockResolvedValue({ count: 2 } as never);

      const recovered = await recoverStuckConfirmations();

      expect(recovered).toBe(2);
      expect(prisma.receiptJob.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "CONFIRMED",
            transactionId: null,
            discardedAt: null,
            updatedAt: { lt: new Date("2024-01-01T00:05:00Z") },
          }),
          data: expect.objectContaining({
            status: "NEEDS_REVIEW",
            updatedAt: new Date("2024-01-01T00:10:00Z"),
          }),
        })
      );

      vi.useRealTimers();
    });
  });

  describe("patchJob", () => {
    it("allows patching NEEDS_REVIEW jobs", async () => {
      const job = buildJob({ status: "NEEDS_REVIEW" });
      const updatedJob = { ...job, merchant: "New Merchant" };

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          receiptCorrection: { createMany: vi.fn() },
          receiptJob: { update: vi.fn().mockResolvedValue(updatedJob) },
        };
        return fn(tx as never);
      });

      const result = await patchJob("user-1", "job-1", { merchant: "New Merchant" });

      expect(result.success).toBe(true);
    });

    it("allows patching COMPLETED jobs", async () => {
      const job = buildJob({ status: "COMPLETED" });
      const updatedJob = { ...job, merchant: "New Merchant" };

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          receiptCorrection: { createMany: vi.fn() },
          receiptJob: { update: vi.fn().mockResolvedValue(updatedJob) },
        };
        return fn(tx as never);
      });

      const result = await patchJob("user-1", "job-1", { merchant: "New Merchant" });

      expect(result.success).toBe(true);
    });

    it("rejects patching CONFIRMED jobs", async () => {
      const job = buildJob({ status: "CONFIRMED", transactionId: "txn-123" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);

      const result = await patchJob("user-1", "job-1", { merchant: "New Merchant" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_STATUS");
      }
    });

    it("rejects patching PROCESSING jobs", async () => {
      const job = buildJob({ status: "PROCESSING" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);

      const result = await patchJob("user-1", "job-1", { merchant: "New Merchant" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_STATUS");
      }
    });

    it("rejects negative totalAmount", async () => {
      const job = buildJob({ status: "NEEDS_REVIEW" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);

      const result = await patchJob("user-1", "job-1", { totalAmount: -10 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("VALIDATION_ERROR");
      }
    });

    it("rejects NaN totalAmount", async () => {
      const job = buildJob({ status: "NEEDS_REVIEW" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);

      const result = await patchJob("user-1", "job-1", { totalAmount: Number.NaN });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("VALIDATION_ERROR");
      }
    });

    it("rejects NaN taxAmount", async () => {
      const job = buildJob({ status: "NEEDS_REVIEW" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);

      const result = await patchJob("user-1", "job-1", { taxAmount: Number.NaN });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("VALIDATION_ERROR");
      }
    });

    it("rejects invalid date format", async () => {
      const job = buildJob({ status: "NEEDS_REVIEW" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);

      const result = await patchJob("user-1", "job-1", { date: "not-a-date" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("retryJob", () => {
    it("allows retry for FAILED jobs", async () => {
      const job = buildJob({ status: "FAILED", lastError: "Some error" });
      const retriedJob = { ...job, status: "QUEUED", attempts: 0, lastError: null };

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);
      vi.mocked(prisma.receiptJob.update).mockResolvedValue(retriedJob as never);

      const result = await retryJob("user-1", "job-1");

      expect(result.success).toBe(true);
      expect(prisma.receiptJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "QUEUED",
            attempts: 0,
            lastError: null,
          }),
        })
      );
    });

    it("rejects retry for COMPLETED jobs", async () => {
      const job = buildJob({ status: "COMPLETED" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);

      const result = await retryJob("user-1", "job-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_STATUS");
      }
    });

    it("rejects retry for QUEUED jobs", async () => {
      const job = buildJob({ status: "QUEUED" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);

      const result = await retryJob("user-1", "job-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_STATUS");
      }
    });
  });

  describe("discardJob", () => {
    it("soft-deletes NEEDS_REVIEW jobs by setting discardedAt", async () => {
      const job = buildJob({ status: "NEEDS_REVIEW" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);
      vi.mocked(prisma.receiptJob.update).mockResolvedValue({ ...job, discardedAt: new Date() } as never);

      const result = await discardJob("user-1", "job-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deleted).toBe(true);
      }
      expect(prisma.receiptJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discardedAt: expect.any(Date),
          }),
        })
      );
    });

    it("allows discarding FAILED jobs", async () => {
      const job = buildJob({ status: "FAILED" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);
      vi.mocked(prisma.receiptJob.update).mockResolvedValue({ ...job, discardedAt: new Date() } as never);

      const result = await discardJob("user-1", "job-1");

      expect(result.success).toBe(true);
    });

    it("rejects discarding CONFIRMED jobs", async () => {
      const job = buildJob({ status: "CONFIRMED", transactionId: "txn-123" });

      vi.mocked(prisma.receiptJob.findFirst).mockResolvedValue(job as never);

      const result = await discardJob("user-1", "job-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_STATUS");
        expect(result.error).toContain("linked transaction");
      }
    });
  });

  describe("listInbox", () => {
    it("returns jobs with inbox statuses by default", async () => {
      const jobs = [
        buildJob({ id: "job-1", status: "NEEDS_REVIEW" }),
        buildJob({ id: "job-2", status: "COMPLETED" }),
        buildJob({ id: "job-3", status: "FAILED" }),
      ];

      vi.mocked(prisma.receiptJob.findMany).mockResolvedValue(jobs as never);

      const result = await listInbox("user-1");

      expect(result.success).toBe(true);
      expect(prisma.receiptJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-1",
            status: { in: ["NEEDS_REVIEW", "COMPLETED", "FAILED"] },
          }),
        })
      );
    });

    it("filters by specific status", async () => {
      const jobs = [buildJob({ id: "job-1", status: "NEEDS_REVIEW" })];

      vi.mocked(prisma.receiptJob.findMany).mockResolvedValue(jobs as never);

      const result = await listInbox("user-1", { status: "NEEDS_REVIEW" });

      expect(result.success).toBe(true);
      expect(prisma.receiptJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ["NEEDS_REVIEW"] },
          }),
        })
      );
    });

    it("supports cursor-based pagination", async () => {
      const jobs = [buildJob({ id: "job-1" })];

      vi.mocked(prisma.receiptJob.findMany).mockResolvedValue(jobs as never);

      const cursor = "2024-03-01T00:00:00.000Z";
      await listInbox("user-1", { cursor });

      expect(prisma.receiptJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { lt: new Date(cursor) },
          }),
        })
      );
    });
  });
});
