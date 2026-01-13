import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

/**
 * Development-only seed route.
 * 
 * SECURITY: This route is protected by multiple layers:
 * 1. NODE_ENV must not be "production"
 * 2. ENABLE_DEV_ROUTES env var must be explicitly set to "true"
 * 3. User must be authenticated
 * 
 * This prevents accidental data wipes if NODE_ENV is misconfigured.
 */

function isDevRouteEnabled(): boolean {
    // Must not be production
    if (process.env.NODE_ENV === "production") {
        return false;
    }
    // Require explicit opt-in via environment variable
    if (process.env.ENABLE_DEV_ROUTES !== "true") {
        return false;
    }
    return true;
}

// Bay Area (San Francisco) tax rates
const SF_SALES_TAX = 0.08625;

interface TxInput {
    daysAgo: number;
    merchant: string;
    preTax: number;
    taxRate: number;
    type: "SALES_TAX" | "INCOME_TAX" | "OTHER";
    desc: string;
    priority?: "HIGH" | "MEDIUM" | "LOW";
}

const txData: TxInput[] = [
    // TODAY
    { daysAgo: 0, merchant: "Starbucks", preTax: 6.50, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Morning coffee", priority: "LOW" },
    { daysAgo: 0, merchant: "Whole Foods", preTax: 45.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Groceries", priority: "MEDIUM" },
    { daysAgo: 0, merchant: "Uber", preTax: 28.00, taxRate: 0, type: "OTHER", desc: "Ride to work", priority: "LOW" },
    { daysAgo: 0, merchant: "Chipotle", preTax: 15.50, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Lunch", priority: "LOW" },

    // YESTERDAY
    { daysAgo: 1, merchant: "Target", preTax: 89.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Household items", priority: "MEDIUM" },
    { daysAgo: 1, merchant: "Shell Gas", preTax: 65.00, taxRate: 0.0511, type: "SALES_TAX", desc: "Gas", priority: "MEDIUM" },
    { daysAgo: 1, merchant: "Amazon", preTax: 125.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Electronics", priority: "HIGH" },

    // 2 DAYS AGO
    { daysAgo: 2, merchant: "Trader Joe's", preTax: 78.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Weekly groceries", priority: "MEDIUM" },
    { daysAgo: 2, merchant: "Netflix", preTax: 22.99, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Streaming", priority: "LOW" },

    // 3 DAYS AGO
    { daysAgo: 3, merchant: "CVS", preTax: 35.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Medicine", priority: "MEDIUM" },
    { daysAgo: 3, merchant: "DoorDash", preTax: 42.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Dinner", priority: "LOW" },

    // 4 DAYS AGO
    { daysAgo: 4, merchant: "Costco", preTax: 285.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Bulk shopping", priority: "HIGH" },
    { daysAgo: 4, merchant: "Spotify", preTax: 14.99, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Music", priority: "LOW" },

    // 5 DAYS AGO
    { daysAgo: 5, merchant: "Safeway", preTax: 62.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Groceries", priority: "MEDIUM" },
    { daysAgo: 5, merchant: "Home Depot", preTax: 156.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Home improvement", priority: "HIGH" },

    // 6 DAYS AGO
    { daysAgo: 6, merchant: "Best Buy", preTax: 299.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Headphones", priority: "HIGH" },
    { daysAgo: 6, merchant: "PG&E", preTax: 145.00, taxRate: 0, type: "OTHER", desc: "Electric", priority: "MEDIUM" },

    // 7 DAYS AGO - INSURANCE
    { daysAgo: 7, merchant: "State Farm", preTax: 185.00, taxRate: 0.035, type: "OTHER", desc: "Car insurance", priority: "HIGH" },
    { daysAgo: 7, merchant: "Kaiser", preTax: 450.00, taxRate: 0, type: "OTHER", desc: "Health insurance", priority: "HIGH" },

    // 2 WEEKS AGO
    { daysAgo: 14, merchant: "Apple", preTax: 1099.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "iPhone 15", priority: "HIGH" },
    { daysAgo: 14, merchant: "Uniqlo", preTax: 89.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Clothing", priority: "MEDIUM" },

    // 3 WEEKS AGO
    { daysAgo: 21, merchant: "REI", preTax: 245.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Outdoor gear", priority: "MEDIUM" },
    { daysAgo: 21, merchant: "Comcast", preTax: 89.00, taxRate: 0.08, type: "OTHER", desc: "Internet", priority: "MEDIUM" },

    // 1 MONTH AGO - TAX PAYMENTS
    { daysAgo: 30, merchant: "IRS", preTax: 2500.00, taxRate: 0, type: "INCOME_TAX", desc: "Q4 estimated tax", priority: "HIGH" },
    { daysAgo: 30, merchant: "CA FTB", preTax: 850.00, taxRate: 0, type: "INCOME_TAX", desc: "CA state tax", priority: "HIGH" },
];

export async function POST() {
    // Security check: require explicit dev route enablement
    if (!isDevRouteEnabled()) {
        return NextResponse.json(
            { error: "Dev routes are not enabled. Set ENABLE_DEV_ROUTES=true in development." },
            { status: 403 }
        );
    }

    try {
        const user = await getAuthUser();
        if (!user) {
            return ApiErrors.unauthorized();
        }

        // Clear existing transactions
        const deleted = await prisma.transaction.deleteMany({ where: { userId: user.id } });

        // Create new transactions
        let created = 0;
        for (const input of txData) {
            const tax = input.preTax * input.taxRate;
            const total = input.preTax + tax;
            const date = new Date();
            date.setDate(date.getDate() - input.daysAgo);
            date.setHours(12, 0, 0, 0);

            await prisma.transaction.create({
                data: {
                    userId: user.id,
                    date,
                    type: input.type,
                    description: input.desc,
                    merchant: input.merchant,
                    totalAmount: total,
                    taxAmount: tax,
                    currency: "USD",
                    priority: input.priority || "MEDIUM",
                },
            });
            created++;
        }

        const transactions = txData.map(input => {
            const tax = input.preTax * input.taxRate;
            return { total: input.preTax + tax, tax };
        });
        const totalSpent = transactions.reduce((sum, tx) => sum + tx.total, 0);
        const totalTax = transactions.reduce((sum, tx) => sum + tx.tax, 0);

        return NextResponse.json({
            success: true,
            deleted: deleted.count,
            created,
            summary: {
                totalSpent: totalSpent.toFixed(2),
                totalTax: totalTax.toFixed(2),
                effectiveRate: ((totalTax / totalSpent) * 100).toFixed(2) + "%",
            },
        });
    } catch (error) {
        logger.error("Seed error", { error });
        return NextResponse.json({ error: "Seed failed" }, { status: 500 });
    }
}
