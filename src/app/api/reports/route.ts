import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { parseDateInput } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { dateStringSchema } from "@/lib/schemas";
import { TYPE_LABELS } from "@/lib/constants";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const reportQuerySchema = z.object({
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
    format: z.enum(["pdf", "csv"]).default("pdf"),
    groupBy: z.enum(["month", "type", "merchant"]).default("month"),
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

        const { searchParams } = new URL(request.url);
        const params: Record<string, string> = {};
        searchParams.forEach((value, key) => {
            params[key] = value;
        });

        const parseResult = reportQuerySchema.safeParse(params);
        if (!parseResult.success) {
            return attachRequestId(
                ApiErrors.validation(
                    parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
                ),
                requestId
            );
        }

        const { from, to, format, groupBy } = parseResult.data;

        // Default to current year
        const fromDate = from
            ? parseDateInput(from, "start")
            : new Date(new Date().getFullYear(), 0, 1);
        const toDate = to ? parseDateInput(to, "end") : new Date();

        // Fetch transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                userId: user.id,
                date: {
                    gte: fromDate,
                    lte: toDate,
                },
            },
            orderBy: { date: "asc" },
        });

        // Fetch user for report header
        const userData = await prisma.user.findUnique({
            where: { id: user.id },
            select: { name: true, email: true },
        });

        // Calculate summary
        const totalTax = transactions.reduce(
            (sum, t) => sum + parseFloat(t.taxAmount.toString()),
            0
        );
        const totalSpent = transactions.reduce(
            (sum, t) => sum + parseFloat(t.totalAmount.toString()),
            0
        );

        // Group data based on groupBy parameter
        const groupedData = groupTransactions(transactions, groupBy);

        if (format === "csv") {
            const csv = generateCSV(transactions, groupedData, groupBy, fromDate, toDate, totalTax, totalSpent);

            const filename = `tax-report-${fromDate.toISOString().split("T")[0]}-to-${toDate.toISOString().split("T")[0]}.csv`;

            const response = new NextResponse(csv, {
                headers: {
                    "Content-Type": "text/csv",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                },
            });
            rateLimitResult.headers.forEach((value, key) => {
                response.headers.set(key, value);
            });
            response.headers.set("X-Request-Id", requestId);
            return response;
        }

        // Generate PDF
        const pdfBytes = generatePDF(
            transactions,
            groupedData,
            groupBy,
            fromDate,
            toDate,
            totalTax,
            totalSpent,
            userData?.name || userData?.email || "User"
        );

        const filename = `tax-report-${fromDate.toISOString().split("T")[0]}-to-${toDate.toISOString().split("T")[0]}.pdf`;

        const response = new NextResponse(Buffer.from(pdfBytes), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
        rateLimitResult.headers.forEach((value, key) => {
            response.headers.set(key, value);
        });
        response.headers.set("X-Request-Id", requestId);
        return response;
    } catch (error) {
        logger.error("Error generating report", {
            requestId,
            userId,
            path: request.nextUrl.pathname,
            method: request.method,
            error,
        });
        return attachRequestId(ApiErrors.internal(), requestId);
    }
}

interface Transaction {
    id: string;
    date: Date;
    type: string;
    description: string | null;
    merchant: string | null;
    totalAmount: { toString(): string };
    taxAmount: { toString(): string };
    currency: string;
}

interface GroupedItem {
    key: string;
    label: string;
    count: number;
    totalTax: number;
    totalSpent: number;
}

function groupTransactions(
    transactions: Transaction[],
    groupBy: "month" | "type" | "merchant"
): GroupedItem[] {
    const groups = new Map<string, GroupedItem>();

    for (const tx of transactions) {
        let key: string;
        let label: string;

        if (groupBy === "month") {
            const date = new Date(tx.date);
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            label = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(date);
        } else if (groupBy === "type") {
            key = tx.type;
            label = TYPE_LABELS[tx.type as keyof typeof TYPE_LABELS] || tx.type;
        } else {
            key = tx.merchant || "Unknown";
            label = tx.merchant || "Unknown Merchant";
        }

        const existing = groups.get(key) || {
            key,
            label,
            count: 0,
            totalTax: 0,
            totalSpent: 0,
        };

        existing.count += 1;
        existing.totalTax += parseFloat(tx.taxAmount.toString());
        existing.totalSpent += parseFloat(tx.totalAmount.toString());
        groups.set(key, existing);
    }

    return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
}

function escapeCsvCell(value: string): string {
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function generateCSV(
    transactions: Transaction[],
    groupedData: GroupedItem[],
    groupBy: string,
    fromDate: Date,
    toDate: Date,
    totalTax: number,
    totalSpent: number
): string {
    const lines: string[] = [];

    // Header section
    lines.push("Tax Report");
    lines.push(`Period: ${formatDate(fromDate)} - ${formatDate(toDate)}`);
    lines.push(`Generated: ${formatDate(new Date())}`);
    lines.push("");

    // Summary
    lines.push("SUMMARY");
    lines.push(`Total Tax Paid,${totalTax.toFixed(2)}`);
    lines.push(`Total Spent,${totalSpent.toFixed(2)}`);
    lines.push(`Transaction Count,${transactions.length}`);
    lines.push("");

    // Grouped Summary
    lines.push(`BY ${groupBy.toUpperCase()}`);
    lines.push(`${groupBy === "month" ? "Period" : groupBy === "type" ? "Type" : "Merchant"},Transactions,Tax,Total`);
    for (const group of groupedData) {
        lines.push(
            `${escapeCsvCell(group.label)},${group.count},${group.totalTax.toFixed(2)},${group.totalSpent.toFixed(2)}`
        );
    }
    lines.push("");

    // Transaction details
    lines.push("TRANSACTION DETAILS");
    lines.push("Date,Type,Merchant,Description,Total,Tax,Currency");
    for (const tx of transactions) {
        const type = TYPE_LABELS[tx.type as keyof typeof TYPE_LABELS] || tx.type;
        const merchant = tx.merchant ? escapeCsvCell(tx.merchant) : "";
        const description = tx.description ? escapeCsvCell(tx.description) : "";
        lines.push(
            `${new Date(tx.date).toISOString().split("T")[0]},${escapeCsvCell(type)},${merchant},${description},${tx.totalAmount.toString()},${tx.taxAmount.toString()},${tx.currency}`
        );
    }

    return lines.join("\n");
}

function generatePDF(
    transactions: Transaction[],
    groupedData: GroupedItem[],
    groupBy: string,
    fromDate: Date,
    toDate: Date,
    totalTax: number,
    totalSpent: number,
    userName: string
): Uint8Array {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Tax Report", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    // Subtitle
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`${formatDate(fromDate)} - ${formatDate(toDate)}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 8;
    doc.setFontSize(10);
    doc.text(`Generated for: ${userName}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Summary Box
    doc.setFillColor(245, 245, 245);
    doc.rect(14, yPos - 3, pageWidth - 28, 25, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 20, yPos + 5);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Tax Paid: ${formatCurrency(totalTax)}`, 20, yPos + 13);
    doc.text(`Total Spent: ${formatCurrency(totalSpent)}`, 100, yPos + 13);
    doc.text(`Transactions: ${transactions.length}`, 20, yPos + 20);
    yPos += 35;

    // Grouped Summary Table
    doc.setFont("helvetica", "bold");
    doc.text(`Summary by ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`, 14, yPos);
    yPos += 5;

    autoTable(doc, {
        startY: yPos,
        head: [[groupBy === "month" ? "Period" : groupBy === "type" ? "Type" : "Merchant", "# Trans", "Tax", "Total"]],
        body: groupedData.map((g) => [
            g.label,
            g.count.toString(),
            formatCurrency(g.totalTax),
            formatCurrency(g.totalSpent),
        ]),
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
    });

    // @ts-expect-error autoTable adds lastAutoTable to doc
    yPos = doc.lastAutoTable.finalY + 15;

    // Check if we need a new page for transaction details
    if (yPos > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        yPos = 20;
    }

    // Transaction Details Table
    doc.setFont("helvetica", "bold");
    doc.text("Transaction Details", 14, yPos);
    yPos += 5;

    autoTable(doc, {
        startY: yPos,
        head: [["Date", "Type", "Merchant", "Tax", "Total"]],
        body: transactions.map((tx) => [
            formatDate(new Date(tx.date)),
            TYPE_LABELS[tx.type as keyof typeof TYPE_LABELS] || tx.type,
            tx.merchant || "—",
            formatCurrency(parseFloat(tx.taxAmount.toString())),
            formatCurrency(parseFloat(tx.totalAmount.toString())),
        ]),
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 25 },
            2: { cellWidth: 50 },
            3: { cellWidth: 30 },
            4: { cellWidth: 30 },
        },
    });

    // Footer with generation timestamp
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(
            `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: "center" }
        );
    }

    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    return new Uint8Array(bytes);
}
