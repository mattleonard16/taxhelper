/**
 * Tax Season Export API Endpoint
 * Generates a ZIP file with CSV summary and organized receipts
 * GET /api/export?year=2024
 * GET /api/export?ids=id1,id2&format=csv
 * GET /api/export?format=csv&from=YYYY-MM-DD&to=YYYY-MM-DD&type=SALES_TAX
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, ApiErrors, getRequestId, attachRequestId, parseSearchParams } from '@/lib/api-utils';
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { generateTaxSeasonCSV } from '@/lib/export/csv-generator';
import { organizeReceiptsByCategory } from '@/lib/export/folder-organizer';
import { createTaxSeasonZip, generateZipFilename } from '@/lib/export/zip-creator';
import { getReceiptBytes } from '@/lib/receipt/receipt-storage';
import { transactionQuerySchema } from '@/lib/schemas';
import { buildTransactionSearchWhere } from '@/lib/transactions/transaction-search';
import { z } from 'zod';

const yearExportSchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    includeSummary: z.coerce.boolean().optional(),
});

const idsExportSchema = z.object({
    ids: z.preprocess(
        (val) => {
            if (typeof val !== 'string' || val.trim() === '') return undefined;
            const ids = val
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean);
            return ids.length > 0 ? ids : undefined;
        },
        z.array(z.string().min(1)).max(200)
    ),
    includeSummary: z.coerce.boolean().optional(),
    format: z.preprocess(
        (val) => (typeof val === 'string' ? val.toLowerCase() : val),
        z.enum(['csv']).optional()
    ),
});

const exportFormatSchema = z.preprocess(
    (val) => (typeof val === 'string' ? val.toLowerCase() : val),
    z.enum(['csv', 'json'])
);

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
        const params = parseSearchParams(searchParams);

        if (params.year) {
            if (params.ids) {
                return attachRequestId(ApiErrors.validation('Provide either year or ids, not both'), requestId);
            }
            if (params.format) {
                return attachRequestId(ApiErrors.validation('format is not supported with year exports'), requestId);
            }

            const parseResult = yearExportSchema.safeParse(params);
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

            const csv = generateTaxSeasonCSV(csvTransactions, { includeSummary: includeSummary ?? true });

            const receiptsWithPaths = csvTransactions
                .filter(t => t.receiptPath)
                .map(t => ({
                    path: t.receiptPath!,
                    category: t.type,
                }));

            const receiptsWithContent = await Promise.all(
                receiptsWithPaths.map(async (receipt) => {
                    try {
                        const bytes = await getReceiptBytes(receipt.path);
                        if (!bytes) return null;
                        return {
                            ...receipt,
                            content: Buffer.from(bytes),
                        };
                    } catch (error) {
                        logger.error('Error reading receipt for export', {
                            requestId,
                            userId,
                            receiptPath: receipt.path,
                            error,
                        });
                        return null;
                    }
                })
            );

            const organizedReceipts = receiptsWithContent.length > 0
                ? organizeReceiptsByCategory(receiptsWithContent.filter(Boolean) as Array<{
                    path: string;
                    category: string;
                    content: Buffer;
                }>)
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
        }

        if (params.ids) {
            if (params.year) {
                return attachRequestId(ApiErrors.validation('Provide either year or ids, not both'), requestId);
            }

            const parseResult = idsExportSchema.safeParse(params);
            if (!parseResult.success) {
                return attachRequestId(
                    ApiErrors.validation(
                        parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
                    ),
                    requestId
                );
            }

            const { ids, includeSummary } = parseResult.data;
            const uniqueIds = Array.from(new Set(ids));

            const transactions = await prisma.transaction.findMany({
                where: {
                    userId: user.id,
                    id: { in: uniqueIds },
                },
                orderBy: { date: 'asc' },
            });

            if (transactions.length === 0) {
                return attachRequestId(
                    NextResponse.json({
                        error: 'No transactions found for the selected ids',
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

            const csv = generateTaxSeasonCSV(csvTransactions, {
                includeSummary: includeSummary ?? false,
            });

            const filename = `TaxHelper-Selected-${new Date().toISOString().split('T')[0]}.csv`;
            const response = new NextResponse(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'X-Request-Id': requestId,
                },
            });

            rateLimitResult.headers.forEach((value, key) => {
                response.headers.set(key, value);
            });

            return response;
        }

        if (params.format) {
            const formatResult = exportFormatSchema.safeParse(params.format);
            if (!formatResult.success) {
                return attachRequestId(ApiErrors.validation('format must be csv or json'), requestId);
            }

            const parseResult = transactionQuerySchema.safeParse(params);
            if (!parseResult.success) {
                return attachRequestId(
                    ApiErrors.validation(
                        parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
                    ),
                    requestId
                );
            }

            const { from, to, type, search, minAmount, maxAmount, category, isDeductible, priority } = parseResult.data;
            const where = buildTransactionSearchWhere(user.id, {
                from,
                to,
                type,
                search,
                minAmount,
                maxAmount,
                category,
                isDeductible,
                priority,
            });

            const transactions = await prisma.transaction.findMany({
                where,
                orderBy: { date: 'asc' },
            });

            if (transactions.length === 0) {
                return attachRequestId(
                    NextResponse.json({
                        error: 'No transactions found for the specified filters',
                        code: 'NO_DATA',
                    }, { status: 404 }),
                    requestId
                );
            }

            if (formatResult.data === 'json') {
                const jsonTransactions = transactions.map(t => ({
                    ...t,
                    totalAmount: t.totalAmount.toString(),
                    taxAmount: t.taxAmount.toString(),
                }));

                const filename = `TaxHelper-Export-${new Date().toISOString().split('T')[0]}.json`;
                const response = new NextResponse(JSON.stringify({ transactions: jsonTransactions }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Content-Disposition': `attachment; filename="${filename}"`,
                        'X-Request-Id': requestId,
                    },
                });

                rateLimitResult.headers.forEach((value, key) => {
                    response.headers.set(key, value);
                });

                return response;
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

            const csv = generateTaxSeasonCSV(csvTransactions);
            const filename = `TaxHelper-Export-${new Date().toISOString().split('T')[0]}.csv`;
            const response = new NextResponse(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'X-Request-Id': requestId,
                },
            });

            rateLimitResult.headers.forEach((value, key) => {
                response.headers.set(key, value);
            });

            return response;
        }

        return attachRequestId(ApiErrors.validation('year, ids, or format is required'), requestId);
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
