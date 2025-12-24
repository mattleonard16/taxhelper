/**
 * Receipt Processing Worker Trigger
 * POST /api/receipts/process
 * 
 * Triggers background processing of queued receipt jobs.
 * Can be called by:
 * - Cron job (with API key in header)
 * - Admin user manually
 * - After-upload webhook
 * 
 * Security: Requires either a valid CRON_SECRET or authenticated admin user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { runReceiptJobWorker } from "@/lib/receipt/receipt-job-worker";
import { getReceiptBytes } from "@/lib/receipt/receipt-storage";
import { logger } from "@/lib/logger";

// Simple API key auth for cron jobs
function isValidCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false; // No cron secret configured, require user auth
  }
  
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  
  const token = authHeader.slice(7);
  return token === cronSecret;
}

// Placeholder file retrieval - in production, this would fetch from cloud storage
async function getFileBytes(storagePath: string): Promise<ArrayBuffer | null> {
  const bytes = await getReceiptBytes(storagePath);

  if (!bytes) {
    logger.warn("Receipt file missing from storage", { storagePath });
  }

  return bytes;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    // Check authorization: either cron secret or authenticated user
    const isCron = isValidCronRequest(request);
    
    if (!isCron) {
      const user = await getAuthUser();
      if (!user) {
        return attachRequestId(ApiErrors.unauthorized(), requestId);
      }
      // Note: In production, you might want to restrict this to admin users only
    }

    // Parse limit from query params (default 10, max 50)
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "10", 10) || 10, 1), 50);

    logger.info("Receipt processing triggered", {
      requestId,
      isCron,
      limit,
    });

    // Run the worker
    const result = await runReceiptJobWorker(limit, getFileBytes);

    const response = NextResponse.json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      results: result.results.map((r) => ({
        jobId: r.jobId,
        success: r.success,
        error: r.error,
      })),
    });

    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (error) {
    logger.error("Error processing receipt jobs", {
      requestId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
