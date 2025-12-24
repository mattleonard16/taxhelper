/**
 * Receipt Upload API Endpoint
 * Handles receipt image/PDF uploads with OCR processing
 * POST /api/receipts/upload
 * 
 * Query params:
 * - async=1: Queue for background processing, return job ID immediately
 *   (default: false, process synchronously)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from '@/lib/api-utils';
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from '@/lib/rate-limit';
import { LLMBudgetExceededError, LLMRateLimitError } from '@/lib/llm/errors';
import { logger } from '@/lib/logger';
import { generateReceiptFilename, generateStoragePath, isValidReceiptFile, getFileExtension, getExtensionFromMimeType, arrayBufferToBase64 } from '@/lib/receipt/receipt-utils';
import { summarizeReceiptItems } from '@/lib/receipt/receipt-ocr';
import { extractReceiptData } from '@/lib/receipt/receipt-extraction';
import { createReceiptJobRepository } from '@/lib/receipt/receipt-job-repository';
import { storeReceiptBytes } from '@/lib/receipt/receipt-storage';
import { TransactionType } from '@/lib/schemas';

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    let userId: string | undefined;

    try {
        const user = await getAuthUser();
        if (!user) {
            return attachRequestId(ApiErrors.unauthorized(), requestId);
        }
        userId = user.id;

        // Rate limiting for file uploads
        const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.mutation);
        if (!rateLimitResult.success) {
            return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
        }

        // Check for async mode
        const { searchParams } = new URL(request.url);
        const asyncMode = searchParams.get('async') === '1' || searchParams.get('async') === 'true';

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const ocrTextValue = formData.get('ocrText');
        const ocrText = typeof ocrTextValue === 'string' ? ocrTextValue : null;
        const ocrConfidenceValue = formData.get('ocrConfidence');
        const transactionType = (formData.get('type') as TransactionType) || 'OTHER';

        if (!file) {
            return attachRequestId(
                ApiErrors.validation('No file provided'),
                requestId
            );
        }

        // Validate file type (check both filename and MIME type)
        if (!isValidReceiptFile(file.name, file.type)) {
            return attachRequestId(
                ApiErrors.validation('Invalid file type. Supported: PDF, JPG, PNG, GIF, WebP, HEIC'),
                requestId
            );
        }

        // File size limit (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return attachRequestId(
                ApiErrors.validation('File too large. Maximum size is 10MB'),
                requestId
            );
        }

        const ocrConfidence = typeof ocrConfidenceValue === 'string'
            ? parseFloat(ocrConfidenceValue)
            : null;

        // Convert file to bytes once for OCR/LLM processing and storage
        const bytes = await file.arrayBuffer();

        // Generate storage path first (needed for both modes)
        const extension = getFileExtension(file.name) || getExtensionFromMimeType(file.type);
        const tempFilename = generateReceiptFilename({
            date: new Date(),
            vendor: null,
            description: null,
            extension,
        });
        const storagePath = generateStoragePath({
            userId: user.id,
            category: transactionType,
            filename: tempFilename,
        });

        // Async mode: create job and return immediately
        if (asyncMode) {
            const repository = createReceiptJobRepository();

            try {
                await storeReceiptBytes(storagePath, bytes);
            } catch (error) {
                logger.error('Failed to persist receipt bytes', {
                    requestId,
                    userId,
                    storagePath,
                    error,
                });
                return attachRequestId(ApiErrors.internal(), requestId);
            }

            const job = await repository.create({
                userId: user.id,
                originalName: file.name,
                mimeType: file.type,
                fileSize: file.size,
                storagePath,
                ocrText,
                ocrConfidence,
            });

            const response = NextResponse.json({
                success: true,
                async: true,
                job: {
                    id: job.id,
                    status: job.status,
                    originalName: job.originalName,
                    pollUrl: `/api/receipts/jobs/${job.id}`,
                },
            }, { status: 202 }); // 202 Accepted

            rateLimitResult.headers.forEach((value, key) => {
                response.headers.set(key, value);
            });
            response.headers.set('X-Request-Id', requestId);

            logger.info('Receipt job queued', {
                requestId,
                userId,
                jobId: job.id,
                originalName: file.name,
            });

            return response;
        }

        // Sync mode: process immediately (existing behavior)
        const extractedData = await extractReceiptData({
            ocrText,
            ocrConfidence,
            image: bytes,
            mimeType: file.type,
            requestId,
            userId,
        });

        // Generate standardized filename with extracted data
        const description = extractedData ? summarizeReceiptItems(extractedData.items) : null;
        const filename = generateReceiptFilename({
            date: extractedData?.date ? new Date(extractedData.date) : new Date(),
            vendor: extractedData?.merchant,
            description,
            extension,
        });

        // Generate final storage path
        const finalStoragePath = generateStoragePath({
            userId: user.id,
            category: transactionType,
            filename,
        });

        // Convert file to base64 for storage (in production, use cloud storage)
        const base64 = arrayBufferToBase64(bytes);

        const response = NextResponse.json({
            success: true,
            async: false,
            data: {
                filename,
                storagePath: finalStoragePath,
                originalName: file.name,
                size: file.size,
                type: file.type,
                base64Preview: base64.substring(0, 100) + '...', // Preview only
                extracted: extractedData,
            },
        });

        rateLimitResult.headers.forEach((value, key) => {
            response.headers.set(key, value);
        });
        response.headers.set('X-Request-Id', requestId);

        return response;
    } catch (error) {
        // Handle LLM-specific errors with appropriate status codes
        if (error instanceof LLMRateLimitError) {
            const retryAfterSec = Math.ceil((error.retryAfterMs || 60000) / 1000);
            const response = NextResponse.json(
                { 
                    error: 'LLM rate limit exceeded',
                    code: 'LLM_RATE_LIMITED',
                    retryAfter: retryAfterSec,
                },
                { status: 429 }
            );
            response.headers.set('Retry-After', String(retryAfterSec));
            return attachRequestId(response, requestId);
        }

        if (error instanceof LLMBudgetExceededError) {
            return attachRequestId(
                NextResponse.json(
                    { 
                        error: 'Daily LLM budget exceeded',
                        code: 'BUDGET_EXCEEDED',
                    },
                    { status: 402 } // Payment Required
                ),
                requestId
            );
        }

        logger.error('Error uploading receipt', {
            requestId,
            userId,
            path: request.nextUrl.pathname,
            method: request.method,
            error,
        });
        return attachRequestId(ApiErrors.internal(), requestId);
    }
}
