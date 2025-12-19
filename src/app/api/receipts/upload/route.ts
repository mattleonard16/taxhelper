/**
 * Receipt Upload API Endpoint
 * Handles receipt image/PDF uploads with OCR processing
 * POST /api/receipts/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from '@/lib/api-utils';
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { generateReceiptFilename, generateStoragePath, isValidReceiptFile, getFileExtension, getExtensionFromMimeType } from '@/lib/receipt/receipt-utils';
import { parseReceiptOCR } from '@/lib/receipt/receipt-ocr';
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

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const ocrText = formData.get('ocrText') as string | null;
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

        // Parse OCR text if provided (from client-side Tesseract)
        let extractedData = null;
        if (ocrText) {
            extractedData = parseReceiptOCR(ocrText);
        }

        // Generate standardized filename
        // Use file extension from name, or fallback to MIME type
        const extension = getFileExtension(file.name) || getExtensionFromMimeType(file.type);
        const filename = generateReceiptFilename({
            date: extractedData?.date ? new Date(extractedData.date) : new Date(),
            vendor: extractedData?.vendor,
            description: extractedData?.description,
            extension,
        });

        // Generate storage path
        const storagePath = generateStoragePath({
            userId: user.id,
            category: transactionType,
            filename,
        });

        // Convert file to base64 for storage (in production, use cloud storage)
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');

        const response = NextResponse.json({
            success: true,
            data: {
                filename,
                storagePath,
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
