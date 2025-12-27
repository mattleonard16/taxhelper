/**
 * Receipt Job Worker
 * Processes queued receipt jobs with OCR/LLM extraction.
 * Can be invoked via cron, API endpoint, or manual trigger.
 */

import { createReceiptJobRepository, type ReceiptJobRecord, type ExtractedReceiptData } from "./receipt-job-repository";
import { extractReceiptData } from "./receipt-extraction";
import { determineStatusFromConfidence } from "./receipt-jobs-service";
import { logger } from "@/lib/logger";
import {
  LLMError,
  LLMRateLimitError,
  LLMBudgetExceededError,
  LLMTimeoutError,
  LLMParsingError,
} from "@/lib/llm/errors";

export interface ProcessJobResult {
  jobId: string;
  success: boolean;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  extracted?: ExtractedReceiptData;
}

export interface WorkerRunResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: ProcessJobResult[];
}

export interface WorkerOptions {
  staleAfterMs?: number;
}

/**
 * Process a single receipt job.
 * Reads file from storage, runs extraction, and updates job status.
 */
export async function processReceiptJob(
  job: ReceiptJobRecord,
  getFileBytes: (storagePath: string) => Promise<ArrayBuffer | null>
): Promise<ProcessJobResult> {
  const repository = createReceiptJobRepository();

  try {
    // Mark as processing
    const processingJob = await repository.markProcessing(job.id);
    if (!processingJob) {
      return { jobId: job.id, success: false, error: "Failed to acquire job lock" };
    }

    // Get file bytes from storage
    const bytes = await getFileBytes(job.storagePath);
    if (!bytes) {
      await repository.markFailed(job.id, "File not found in storage");
      return { jobId: job.id, success: false, error: "File not found in storage" };
    }

    // Run extraction (OCR/LLM)
    const extracted = await extractReceiptData({
      ocrText: job.ocrText,
      ocrConfidence: job.ocrConfidence,
      image: bytes,
      mimeType: job.mimeType,
      requestId: `job_${job.id}`,
      userId: job.userId,
    });

    if (!extracted) {
      await repository.markFailed(job.id, "Extraction returned no data");
      return { jobId: job.id, success: false, error: "Extraction returned no data" };
    }

    // Convert extracted data to storage format
    const data: ExtractedReceiptData = {
      merchant: extracted.merchant,
      date: extracted.date ? new Date(extracted.date) : null,
      totalAmount: extracted.total,
      taxAmount: extracted.tax,
      items: extracted.items as unknown as Record<string, unknown>[],
      currency: null, // Currency not extracted by OCR/LLM yet
      category: extracted.category ?? null,
      categoryCode: extracted.categoryCode ?? null,
      isDeductible: extracted.isDeductible ?? false,
      extractionConfidence: extracted.confidence,
    };

    // Determine status based on extraction confidence
    const status = determineStatusFromConfidence(data.extractionConfidence ?? null);

    // Mark as completed with appropriate status
    await repository.markCompleted(job.id, data, status);

    logger.info("Receipt job processed successfully", {
      jobId: job.id,
      userId: job.userId,
      merchant: data.merchant,
      status,
      confidence: data.extractionConfidence,
    });

    return { jobId: job.id, success: true, extracted: data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    let errorCode = "UNKNOWN_ERROR";
    let retryable = false;

    // Categorize errors for better monitoring and handling
    if (error instanceof LLMBudgetExceededError) {
      errorCode = "BUDGET_EXCEEDED";
      retryable = false;
      logger.warn("Receipt job failed: budget exceeded", {
        jobId: job.id,
        userId: job.userId,
        budgetUsd: error.budgetUsd,
        usedUsd: error.usedUsd,
      });
    } else if (error instanceof LLMRateLimitError) {
      errorCode = "RATE_LIMITED";
      retryable = true;
      logger.warn("Receipt job failed: rate limited", {
        jobId: job.id,
        userId: job.userId,
        retryAfterMs: error.retryAfterMs,
      });
    } else if (error instanceof LLMTimeoutError) {
      errorCode = "TIMEOUT";
      retryable = true;
      logger.warn("Receipt job failed: timeout", {
        jobId: job.id,
        userId: job.userId,
      });
    } else if (error instanceof LLMParsingError) {
      errorCode = "PARSING_ERROR";
      retryable = false;
      logger.error("Receipt job failed: parsing error", {
        jobId: job.id,
        userId: job.userId,
        rawResponse: error.rawResponse?.slice(0, 200),
      });
    } else if (error instanceof LLMError) {
      errorCode = error.code;
      retryable = error.retryable;
      logger.error("Receipt job failed: LLM error", {
        jobId: job.id,
        userId: job.userId,
        errorCode,
        retryable,
      });
    } else {
      logger.error("Receipt job processing failed", {
        jobId: job.id,
        userId: job.userId,
        error: errorMessage,
      });
    }

    const fullErrorMessage = `[${errorCode}] ${errorMessage}`;
    await repository.markFailed(job.id, fullErrorMessage);
    
    return { 
      jobId: job.id, 
      success: false, 
      error: errorMessage,
      errorCode,
      retryable,
    };
  }
}

/**
 * Run the worker to process pending jobs.
 * @param limit Maximum number of jobs to process in this run
 * @param getFileBytes Function to retrieve file bytes from storage
 */
export async function runReceiptJobWorker(
  limit: number = 10,
  getFileBytes: (storagePath: string) => Promise<ArrayBuffer | null>,
  options: WorkerOptions = {}
): Promise<WorkerRunResult> {
  const repository = createReceiptJobRepository();
  const results: ProcessJobResult[] = [];
  let succeeded = 0;
  let failed = 0;
  const staleAfterMs = options.staleAfterMs ?? 15 * 60 * 1000;

  try {
    await repository.requeueStaleJobs(staleAfterMs);

    // Get pending jobs
    const jobs = await repository.findPendingJobs(limit);

    logger.info("Receipt job worker starting", {
      jobCount: jobs.length,
      limit,
    });

    // Process each job sequentially to avoid overloading external APIs
    for (const job of jobs) {
      const result = await processReceiptJob(job, getFileBytes);
      results.push(result);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    logger.info("Receipt job worker completed", {
      processed: jobs.length,
      succeeded,
      failed,
    });

    return {
      processed: jobs.length,
      succeeded,
      failed,
      results,
    };
  } catch (error) {
    logger.error("Receipt job worker crashed", { error });
    return {
      processed: results.length,
      succeeded,
      failed,
      results,
    };
  }
}
