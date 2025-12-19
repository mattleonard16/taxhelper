/**
 * Tax Season Export API Endpoint
 * Generates a ZIP file with CSV summary and organized receipts
 * GET /api/export?year=2024
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from '@/lib/api-utils';
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { generateTaxSeasonCSV } from '@/lib/export/csv-generator';
import { organizeReceiptsByCategory } from '@/lib/export/folder-organizer';
import { createTaxSeasonZip, generateZipFilename } from '@/lib/export/zip-creator';
import { z } from 'zod';

const exportQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    includeSummary: z.coerce.boolean().default(true),
});

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    let userId: string | undefined;

    try {
        const user = await getAuthUser();
        if (!user) {
            return attachRequestId(ApiErrors.unauthorized(), requestId);
        }
        userId = user.id;

        // Rate limiting
        const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.api);
        if (!rateLimitResult.success) {
            return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
        }

        // Parse query params
        const { searchParams } = new URL(request.url);
        const params: Record<string, string> = {};
        searchParams.forEach((value, key) => {
            params[key] = value;
        });

        const parseResult = exportQuerySchema.safeParse(params);
        if (!parseResult.success) {
            return attachRequestId(
                ApiErrors.validation(
                    parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
                ),
                requestId
            );
        }

        const { year, includeSummary } = parseResult.data;

        // Fetch transactions for the year
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

        const transactions = await prisma.transaction.findMany({
            where: {
                userId: user.id,
                date: {
                    gte: startOfYear,
                    lte: endOfYear,
                },
            },
            orderBy: { date: 'asc' },
        });

        if (transactions.length === 0) {
            return attachRequestId(
                NextResponse.json({
                    error: 'No transactions found for the specified year',
                    code: 'NO_DATA',
                }, { status: 404 }),
                requestId
            );
        }

        const csvTransactions = transactions.map(t => ({
            id: t.id,
            date: t.date,
            merchant: t.merchant,
            description: t.description,
            totalAmount: t.totalAmount.toString(),
            taxAmount: t.taxAmount.toString(),
            type: t.type,
            receiptPath: (t as { receiptPath?: string | null }).receiptPath ?? null,
        }));

        const csv = generateTaxSeasonCSV(csvTransactions, { includeSummary });

        const receiptsWithPaths = csvTransactions
            .filter(t => t.receiptPath)
            .map(t => ({
                path: t.receiptPath!,
                category: t.type,
            }));

        const organizedReceipts = receiptsWithPaths.length > 0
            ? organizeReceiptsByCategory(receiptsWithPaths)
            : {};

        // Create ZIP with CSV and organized receipt structure
        const zipBuffer = await createTaxSeasonZip({
            csv,
            organizedReceipts,
            year,
        });

        // Return ZIP file
        const filename = generateZipFilename(year);

        // Convert Buffer to Uint8Array for NextResponse
        const response = new NextResponse(new Uint8Array(zipBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'X-Request-Id': requestId,
            },
        });

        rateLimitResult.headers.forEach((value, key) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        logger.error('Error generating export', {
            requestId,
            userId,
            path: request.nextUrl.pathname,
            method: request.method,
            error,
        });
        return attachRequestId(ApiErrors.internal(), requestId);
    }
}
