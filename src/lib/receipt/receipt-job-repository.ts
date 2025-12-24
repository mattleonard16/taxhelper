/**
 * Receipt Job Repository
 * Data access layer for receipt processing jobs.
 */

import { prisma } from "@/lib/prisma";
import { Prisma, type ReceiptJobStatus } from "@prisma/client";

export interface CreateReceiptJobInput {
  userId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  ocrText?: string | null;
  ocrConfidence?: number | null;
}

export interface ReceiptJobRecord {
  id: string;
  userId: string;
  status: ReceiptJobStatus;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  ocrText: string | null;
  ocrConfidence: number | null;
  merchant: string | null;
  date: Date | null;
  totalAmount: string | null;
  taxAmount: string | null;
  items: unknown[] | null;
  currency: string | null;
  // LLM-powered categorization
  category: string | null;
  categoryCode: string | null;
  isDeductible: boolean;
  extractionConfidence: number | null;
  transactionId: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  processedAt: Date | null;
  processingStartedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedReceiptData {
  merchant?: string | null;
  date?: Date | null;
  totalAmount?: number | null;
  taxAmount?: number | null;
  items?: Record<string, unknown>[] | null;
  currency?: string | null;
  // LLM-powered categorization
  category?: string | null;
  categoryCode?: string | null;
  isDeductible?: boolean;
  extractionConfidence?: number | null;
}

export interface ReceiptJobRepository {
  create(input: CreateReceiptJobInput): Promise<ReceiptJobRecord>;
  findById(id: string, userId: string): Promise<ReceiptJobRecord | null>;
  findByUser(userId: string, limit?: number): Promise<ReceiptJobRecord[]>;
  findPendingJobs(limit?: number): Promise<ReceiptJobRecord[]>;
  markProcessing(id: string): Promise<ReceiptJobRecord | null>;
  markCompleted(id: string, data: ExtractedReceiptData, transactionId?: string): Promise<ReceiptJobRecord | null>;
  markFailed(id: string, error: string): Promise<ReceiptJobRecord | null>;
  requeueStaleJobs(staleAfterMs: number): Promise<ReceiptJobRecord[]>;
}

const mapJob = (job: Prisma.ReceiptJobGetPayload<object>): ReceiptJobRecord => ({
  id: job.id,
  userId: job.userId,
  status: job.status,
  originalName: job.originalName,
  mimeType: job.mimeType,
  fileSize: job.fileSize,
  storagePath: job.storagePath,
  ocrText: job.ocrText,
  ocrConfidence: job.ocrConfidence,
  merchant: job.merchant,
  date: job.date,
  totalAmount: job.totalAmount?.toString() ?? null,
  taxAmount: job.taxAmount?.toString() ?? null,
  items: job.items as Record<string, unknown>[] | null,
  currency: job.currency,
  category: job.category,
  categoryCode: job.categoryCode,
  isDeductible: job.isDeductible,
  extractionConfidence: job.extractionConfidence,
  transactionId: job.transactionId,
  attempts: job.attempts,
  maxAttempts: job.maxAttempts,
  lastError: job.lastError,
  processedAt: job.processedAt,
  processingStartedAt: job.processingStartedAt,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
});

export const createReceiptJobRepository = (
  client = prisma
): ReceiptJobRepository => ({
  create: async (input) => {
    const job = await client.receiptJob.create({
      data: {
        userId: input.userId,
        originalName: input.originalName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storagePath: input.storagePath,
        ocrText: input.ocrText ?? null,
        ocrConfidence: input.ocrConfidence ?? null,
        status: "QUEUED",
      },
    });
    return mapJob(job);
  },

  findById: async (id, userId) => {
    const job = await client.receiptJob.findFirst({
      where: { id, userId },
    });
    return job ? mapJob(job) : null;
  },

  findByUser: async (userId, limit = 50) => {
    const jobs = await client.receiptJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return jobs.map(mapJob);
  },

  findPendingJobs: async (limit = 10) => {
    // Find queued jobs that haven't exceeded max attempts
    // We compare attempts < maxAttempts using a raw where condition
    const jobs = await client.receiptJob.findMany({
      where: {
        status: "QUEUED",
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    // Filter out jobs that have exceeded max attempts
    return jobs.filter(j => j.attempts < j.maxAttempts).map(mapJob);
  },

  markProcessing: async (id) => {
    try {
      const updated = await client.receiptJob.updateMany({
        where: { id, status: "QUEUED" },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
          processingStartedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        return null;
      }

      const job = await client.receiptJob.findUnique({ where: { id } });
      return job ? mapJob(job) : null;
    } catch {
      return null;
    }
  },

  markCompleted: async (id, data, transactionId) => {
    try {
      const job = await client.receiptJob.update({
        where: { id },
        data: {
          status: "COMPLETED",
          merchant: data.merchant ?? null,
          date: data.date ?? null,
          totalAmount: data.totalAmount ?? null,
          taxAmount: data.taxAmount ?? null,
          items: data.items ? (data.items as Prisma.InputJsonValue) : Prisma.JsonNull,
          currency: data.currency ?? null,
          category: data.category ?? null,
          categoryCode: data.categoryCode ?? null,
          isDeductible: data.isDeductible ?? false,
          extractionConfidence: data.extractionConfidence ?? null,
          transactionId: transactionId ?? null,
          processedAt: new Date(),
          processingStartedAt: null,
          lastError: null,
        },
      });
      return mapJob(job);
    } catch {
      return null;
    }
  },

  markFailed: async (id, error) => {
    try {
      // Check if we should mark as permanently failed
      const current = await client.receiptJob.findUnique({
        where: { id },
        select: { attempts: true, maxAttempts: true },
      });

      const status = current && current.attempts >= current.maxAttempts 
        ? "FAILED" 
        : "QUEUED"; // Re-queue for retry

      const job = await client.receiptJob.update({
        where: { id },
        data: {
          status,
          lastError: error,
          processingStartedAt: null,
        },
      });
      return mapJob(job);
    } catch {
      return null;
    }
  },

  requeueStaleJobs: async (staleAfterMs) => {
    const cutoff = new Date(Date.now() - staleAfterMs);
    const staleJobs = await client.receiptJob.findMany({
      where: {
        status: "PROCESSING",
        processingStartedAt: { lt: cutoff },
      },
      orderBy: { processingStartedAt: "asc" },
    });

    const updates = await Promise.all(
      staleJobs.map((job) => {
        const status = job.attempts >= job.maxAttempts ? "FAILED" : "QUEUED";
        return client.receiptJob.update({
          where: { id: job.id },
          data: {
            status,
            lastError: "Processing timed out",
            processingStartedAt: null,
          },
        });
      })
    );

    return updates.map(mapJob);
  },
});
