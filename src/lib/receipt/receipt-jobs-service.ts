/**
 * Receipt Jobs Service
 * Domain layer for receipt inbox operations.
 * Enforces business rules and keeps logic testable.
 */

import { prisma } from "@/lib/prisma";
import { operationLogger, startTimer } from "@/lib/logger";
import type { ReceiptJobStatus, Prisma } from "@prisma/client";
import type { CompletionStatus } from "./receipt-job-repository";

// Status semantics (locked definitions)
export const RECEIPT_STATUS = {
  QUEUED: "QUEUED",           // Waiting for worker
  PROCESSING: "PROCESSING",   // Worker is actively extracting
  NEEDS_REVIEW: "NEEDS_REVIEW", // Extraction done, low confidence - user must review
  COMPLETED: "COMPLETED",     // Extraction done, high confidence - awaiting user confirmation
  CONFIRMED: "CONFIRMED",     // User confirmed, transaction created - immutable
  FAILED: "FAILED",           // Terminal unless retried
} as const;

// Confidence threshold for auto-routing
export const CONFIDENCE_THRESHOLD = 0.7;

// Statuses that allow editing
const EDITABLE_STATUSES: ReceiptJobStatus[] = ["NEEDS_REVIEW", "COMPLETED"];

// Statuses shown in inbox
const INBOX_STATUSES: ReceiptJobStatus[] = ["NEEDS_REVIEW", "COMPLETED", "FAILED"];



export interface InboxFilters {
  status?: ReceiptJobStatus | ReceiptJobStatus[];
  cursor?: string;
  limit?: number;
}

export interface InboxJob {
  id: string;
  status: ReceiptJobStatus;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  merchant: string | null;
  date: Date | null;
  totalAmount: string | null;
  taxAmount: string | null;
  category: string | null;
  categoryCode: string | null;
  isDeductible: boolean;
  extractionConfidence: number | null;
  transactionId: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatchJobInput {
  merchant?: string;
  date?: Date | string;
  totalAmount?: number;
  taxAmount?: number;
  category?: string;
  categoryCode?: string;
  isDeductible?: boolean;
}

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

/**
 * Determine status based on extraction confidence
 */
export function determineStatusFromConfidence(confidence: number | null): CompletionStatus {
  if (confidence === null || confidence < CONFIDENCE_THRESHOLD) {
    return "NEEDS_REVIEW";
  }
  return "COMPLETED";
}

/**
 * List receipt jobs for inbox view
 */
export async function listInbox(
  userId: string,
  filters: InboxFilters = {}
): Promise<ServiceResult<{ jobs: InboxJob[]; nextCursor: string | null }>> {
  const limit = Math.min(filters.limit ?? 50, 100);

  let statusFilter: ReceiptJobStatus[];
  if (filters.status) {
    statusFilter = Array.isArray(filters.status) ? filters.status : [filters.status];
  } else {
    statusFilter = INBOX_STATUSES;
  }

  const where: Prisma.ReceiptJobWhereInput = {
    userId,
    status: { in: statusFilter },
    discardedAt: null, // Exclude soft-deleted
  };

  if (filters.cursor) {
    where.createdAt = { lt: new Date(filters.cursor) };
  }

  const jobs = await prisma.receiptJob.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1, // Fetch one extra to determine if there's more
    select: {
      id: true,
      status: true,
      originalName: true,
      mimeType: true,
      fileSize: true,
      storagePath: true,
      merchant: true,
      date: true,
      totalAmount: true,
      taxAmount: true,
      category: true,
      categoryCode: true,
      isDeductible: true,
      extractionConfidence: true,
      transactionId: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = jobs.length > limit;
  const resultJobs = hasMore ? jobs.slice(0, limit) : jobs;
  const nextCursor = hasMore && resultJobs.length > 0
    ? resultJobs[resultJobs.length - 1].createdAt.toISOString()
    : null;

  return {
    success: true,
    data: {
      jobs: resultJobs.map(j => ({
        ...j,
        totalAmount: j.totalAmount?.toString() ?? null,
        taxAmount: j.taxAmount?.toString() ?? null,
      })),
      nextCursor,
    },
  };
}

/**
 * Get a single job by ID
 */
export async function getJob(
  userId: string,
  jobId: string
): Promise<ServiceResult<InboxJob>> {
  const job = await prisma.receiptJob.findFirst({
    where: { id: jobId, userId, discardedAt: null },
  });

  if (!job) {
    return { success: false, error: "Receipt job not found", code: "NOT_FOUND" };
  }

  return {
    success: true,
    data: {
      ...job,
      totalAmount: job.totalAmount?.toString() ?? null,
      taxAmount: job.taxAmount?.toString() ?? null,
    },
  };
}

/**
 * Update extracted fields on a job
 * Only allowed for NEEDS_REVIEW or COMPLETED status
 */
export async function patchJob(
  userId: string,
  jobId: string,
  patch: PatchJobInput
): Promise<ServiceResult<InboxJob>> {
  // Fetch job with ownership check
  const job = await prisma.receiptJob.findFirst({
    where: { id: jobId, userId, discardedAt: null },
  });

  if (!job) {
    return { success: false, error: "Receipt job not found", code: "NOT_FOUND" };
  }

  // Guard: only editable statuses
  if (!EDITABLE_STATUSES.includes(job.status)) {
    return {
      success: false,
      error: `Cannot edit job in ${job.status} status`,
      code: "INVALID_STATUS",
    };
  }

  // Build update data and track corrections
  const updateData: Prisma.ReceiptJobUpdateInput = { updatedAt: new Date() };
  const corrections: Array<{
    receiptJobId: string;
    userId: string;
    fieldName: string;
    originalValue: string | null;
    correctedValue: string;
  }> = [];

  if (patch.merchant !== undefined && patch.merchant !== job.merchant) {
    corrections.push({
      receiptJobId: jobId,
      userId,
      fieldName: "merchant",
      originalValue: job.merchant,
      correctedValue: patch.merchant,
    });
    updateData.merchant = patch.merchant;
  }

  if (patch.date !== undefined) {
    const newDate = typeof patch.date === "string" ? new Date(patch.date) : patch.date;
    if (isNaN(newDate.getTime())) {
      return { success: false, error: "Invalid date format", code: "VALIDATION_ERROR" };
    }
    if (job.date?.toISOString() !== newDate.toISOString()) {
      corrections.push({
        receiptJobId: jobId,
        userId,
        fieldName: "date",
        originalValue: job.date?.toISOString() ?? null,
        correctedValue: newDate.toISOString(),
      });
      updateData.date = newDate;
    }
  }

  if (patch.totalAmount !== undefined) {
    if (Number.isNaN(patch.totalAmount)) {
      return { success: false, error: "Total amount must be a number", code: "VALIDATION_ERROR" };
    }
    if (patch.totalAmount < 0) {
      return { success: false, error: "Total amount cannot be negative", code: "VALIDATION_ERROR" };
    }
    const currentAmount = job.totalAmount?.toNumber();
    if (currentAmount !== patch.totalAmount) {
      corrections.push({
        receiptJobId: jobId,
        userId,
        fieldName: "totalAmount",
        originalValue: currentAmount?.toString() ?? null,
        correctedValue: patch.totalAmount.toString(),
      });
      updateData.totalAmount = patch.totalAmount;
    }
  }

  if (patch.taxAmount !== undefined) {
    if (Number.isNaN(patch.taxAmount)) {
      return { success: false, error: "Tax amount must be a number", code: "VALIDATION_ERROR" };
    }
    if (patch.taxAmount < 0) {
      return { success: false, error: "Tax amount cannot be negative", code: "VALIDATION_ERROR" };
    }
    const currentTax = job.taxAmount?.toNumber();
    if (currentTax !== patch.taxAmount) {
      corrections.push({
        receiptJobId: jobId,
        userId,
        fieldName: "taxAmount",
        originalValue: currentTax?.toString() ?? null,
        correctedValue: patch.taxAmount.toString(),
      });
      updateData.taxAmount = patch.taxAmount;
    }
  }

  if (patch.category !== undefined && patch.category !== job.category) {
    corrections.push({
      receiptJobId: jobId,
      userId,
      fieldName: "category",
      originalValue: job.category,
      correctedValue: patch.category,
    });
    updateData.category = patch.category;
  }

  if (patch.categoryCode !== undefined && patch.categoryCode !== job.categoryCode) {
    updateData.categoryCode = patch.categoryCode;
  }

  if (patch.isDeductible !== undefined && patch.isDeductible !== job.isDeductible) {
    corrections.push({
      receiptJobId: jobId,
      userId,
      fieldName: "isDeductible",
      originalValue: job.isDeductible.toString(),
      correctedValue: patch.isDeductible.toString(),
    });
    updateData.isDeductible = patch.isDeductible;
  }

  // Execute update and corrections in a transaction
  const updated = await prisma.$transaction(async (tx) => {
    // Record corrections
    if (corrections.length > 0) {
      await tx.receiptCorrection.createMany({ data: corrections });
    }

    // Update job
    return tx.receiptJob.update({
      where: { id: jobId },
      data: updateData,
    });
  });

  return {
    success: true,
    data: {
      ...updated,
      totalAmount: updated.totalAmount?.toString() ?? null,
      taxAmount: updated.taxAmount?.toString() ?? null,
    },
  };
}

/**
 * Confirm a job and create a transaction
 * IDEMPOTENT: if already confirmed, returns existing transactionId
 * CONCURRENCY-SAFE: uses conditional claim before creating transaction
 */
export async function confirmJob(
  userId: string,
  jobId: string
): Promise<ServiceResult<{ transactionId: string }>> {
  // Step 1: Fetch job to validate and get data for transaction
  const job = await prisma.receiptJob.findFirst({
    where: { id: jobId, userId, discardedAt: null },
  });

  if (!job) {
    return { success: false, error: "Receipt job not found", code: "NOT_FOUND" };
  }

  // Idempotent: if already confirmed, return existing transactionId
  if (job.status === "CONFIRMED" && job.transactionId) {
    return { success: true, data: { transactionId: job.transactionId } };
  }

  // Guard: only NEEDS_REVIEW or COMPLETED can be confirmed
  if (!EDITABLE_STATUSES.includes(job.status)) {
    return {
      success: false,
      error: `Cannot confirm job in ${job.status} status`,
      code: "INVALID_STATUS",
    };
  }

  // Validate required fields
  const missingFields: string[] = [];
  if (!job.merchant) missingFields.push("merchant");
  if (!job.totalAmount) missingFields.push("totalAmount");
  if (!job.date) missingFields.push("date");

  if (missingFields.length > 0) {
    return {
      success: false,
      error: `Missing required fields: ${missingFields.join(", ")}`,
      code: "VALIDATION_ERROR",
    };
  }

  // Step 2-4: Claim, create transaction, and link in one atomic transaction
  const getElapsed = startTimer();
  try {
    const { transaction } = await prisma.$transaction(async (tx) => {
      const claimed = await tx.receiptJob.updateMany({
        where: {
          id: jobId,
          userId,
          transactionId: null, // Only claim if not already claimed
          status: { in: EDITABLE_STATUSES },
          discardedAt: null,
        },
        data: {
          status: "CONFIRMED", // Mark as confirmed to block other attempts
          updatedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        throw new Error("CONFLICT");
      }

      const refreshedJob = await tx.receiptJob.findUnique({
        where: { id: jobId },
      });

      if (!refreshedJob) {
        throw new Error("NOT_FOUND");
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          date: refreshedJob.date!,
          type: "OTHER",
          description: `Receipt: ${refreshedJob.originalName}`,
          merchant: refreshedJob.merchant,
          totalAmount: refreshedJob.totalAmount!,
          taxAmount: refreshedJob.taxAmount ?? 0,
          receiptPath: refreshedJob.storagePath,
          receiptName: refreshedJob.originalName,
          category: refreshedJob.category,
          categoryCode: refreshedJob.categoryCode,
          isDeductible: refreshedJob.isDeductible,
        },
      });

      const updatedJob = await tx.receiptJob.update({
        where: { id: jobId },
        data: { transactionId: transaction.id },
      });

      return { transaction, updatedJob };
    });

    operationLogger.receiptPipeline("confirm", {
      userId,
      jobId,
      fromStatus: job.status,
      toStatus: "CONFIRMED",
      transactionId: transaction.id,
      durationMs: getElapsed(),
    });

    return { success: true, data: { transactionId: transaction.id } };
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") {
      const refreshed = await prisma.receiptJob.findFirst({
        where: { id: jobId, userId, discardedAt: null },
      });
      if (refreshed?.transactionId) {
        operationLogger.receiptPipeline("confirm", {
          userId,
          jobId,
          toStatus: "CONFIRMED",
          transactionId: refreshed.transactionId,
          durationMs: getElapsed(),
        });
        return { success: true, data: { transactionId: refreshed.transactionId } };
      }
      operationLogger.receiptPipeline("confirm", {
        userId,
        jobId,
        errorCode: "CONFLICT",
        durationMs: getElapsed(),
      });
      return {
        success: false,
        error: "Job was modified by another request",
        code: "CONFLICT",
      };
    }
    throw error;
  }
}

/**
 * Recover confirmations that got stuck without a linked transaction.
 * Resets stale CONFIRMED jobs to NEEDS_REVIEW for reprocessing.
 */
export async function recoverStuckConfirmations(): Promise<number> {
  const getElapsed = startTimer();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const result = await prisma.receiptJob.updateMany({
    where: {
      status: "CONFIRMED",
      transactionId: null,
      discardedAt: null,
      updatedAt: { lt: cutoff },
    },
    data: {
      status: "NEEDS_REVIEW",
      updatedAt: new Date(),
    },
  });

  operationLogger.receiptPipeline("recover_stuck", {
    count: result.count,
    durationMs: getElapsed(),
  });

  return result.count;
}

/**
 * Retry a failed job
 * Only allowed for FAILED status
 */
export async function retryJob(
  userId: string,
  jobId: string
): Promise<ServiceResult<InboxJob>> {
  const job = await prisma.receiptJob.findFirst({
    where: { id: jobId, userId, discardedAt: null },
  });

  if (!job) {
    return { success: false, error: "Receipt job not found", code: "NOT_FOUND" };
  }

  // Guard: only FAILED can be retried
  if (job.status !== "FAILED") {
    return {
      success: false,
      error: `Cannot retry job in ${job.status} status`,
      code: "INVALID_STATUS",
    };
  }

  // Reset to QUEUED
  const updated = await prisma.receiptJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      attempts: 0,
      lastError: null,
      processingStartedAt: null,
      updatedAt: new Date(),
    },
  });

  return {
    success: true,
    data: {
      ...updated,
      totalAmount: updated.totalAmount?.toString() ?? null,
      taxAmount: updated.taxAmount?.toString() ?? null,
    },
  };
}

/**
 * Discard (soft-delete) a job
 * Sets discardedAt timestamp; storage cleanup happens async via cron
 */
export async function discardJob(
  userId: string,
  jobId: string
): Promise<ServiceResult<{ deleted: boolean }>> {
  const job = await prisma.receiptJob.findFirst({
    where: { id: jobId, userId, discardedAt: null },
  });

  if (!job) {
    return { success: false, error: "Receipt job not found", code: "NOT_FOUND" };
  }

  // Guard: cannot discard CONFIRMED (has linked transaction)
  if (job.status === "CONFIRMED") {
    return {
      success: false,
      error: "Cannot discard confirmed receipt with linked transaction",
      code: "INVALID_STATUS",
    };
  }

  // Soft-delete: set discardedAt timestamp
  await prisma.receiptJob.update({
    where: { id: jobId },
    data: { discardedAt: new Date() },
  });

  return { success: true, data: { deleted: true } };
}
