#!/usr/bin/env node
/**
 * Seed realistic Bay Area transactions for dashboard testing
 * Run with: npx ts-node scripts/seed-demo-data.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Bay Area (San Francisco) tax rates
const SF_SALES_TAX = 0.08625; // 8.625%

interface Transaction {
    date: Date;
    type: "SALES_TAX" | "INCOME_TAX" | "OTHER";
    description: string;
    merchant: string;
    totalAmount: number;
    taxAmount: number;
    priority?: "HIGH" | "MEDIUM" | "LOW";
}

function createTransaction(
    daysAgo: number,
    merchant: string,
    preTaxAmount: number,
    taxRate: number,
    type: "SALES_TAX" | "INCOME_TAX" | "OTHER" = "SALES_TAX",
    description?: string,
    priority?: "HIGH" | "MEDIUM" | "LOW"
): Transaction {
    const taxAmount = preTaxAmount * taxRate;
    const totalAmount = preTaxAmount + taxAmount;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(12, 0, 0, 0);

    return {
        date,
        type,
        description: description || `Purchase at ${merchant}`,
        merchant,
        totalAmount,
        taxAmount,
        priority,
    };
}

async function seedDemoData(userId: string) {
    console.log("🌱 Seeding demo transactions for Bay Area resident...\n");

    const transactions: Transaction[] = [
        // TODAY - Typical day
        createTransaction(0, "Starbucks", 6.50, SF_SALES_TAX, "SALES_TAX", "Morning coffee", "LOW"),
        createTransaction(0, "Whole Foods", 45.00, SF_SALES_TAX, "SALES_TAX", "Groceries", "MEDIUM"),
        createTransaction(0, "Uber", 28.00, 0, "OTHER", "Ride to work (no sales tax)", "LOW"),
        createTransaction(0, "Chipotle", 15.50, SF_SALES_TAX, "SALES_TAX", "Lunch", "LOW"),

        // YESTERDAY
        createTransaction(1, "Target", 89.00, SF_SALES_TAX, "SALES_TAX", "Household items", "MEDIUM"),
        createTransaction(1, "Shell Gas Station", 65.00, 0.0511, "SALES_TAX", "Gas (CA excise tax)", "MEDIUM"),
        createTransaction(1, "Amazon (taxable)", 125.00, SF_SALES_TAX, "SALES_TAX", "Electronics", "HIGH"),

        // 2 DAYS AGO
        createTransaction(2, "Trader Joe's", 78.00, SF_SALES_TAX, "SALES_TAX", "Weekly groceries", "MEDIUM"),
        createTransaction(2, "Netflix", 22.99, SF_SALES_TAX, "SALES_TAX", "Streaming subscription", "LOW"),

        // 3 DAYS AGO
        createTransaction(3, "CVS Pharmacy", 35.00, SF_SALES_TAX, "SALES_TAX", "Medicine & toiletries", "MEDIUM"),
        createTransaction(3, "DoorDash", 42.00, SF_SALES_TAX, "SALES_TAX", "Dinner delivery", "LOW"),

        // 4 DAYS AGO
        createTransaction(4, "Costco", 285.00, SF_SALES_TAX, "SALES_TAX", "Bulk shopping", "HIGH"),
        createTransaction(4, "Spotify", 14.99, SF_SALES_TAX, "SALES_TAX", "Music subscription", "LOW"),

        // 5 DAYS AGO
        createTransaction(5, "Safeway", 62.00, SF_SALES_TAX, "SALES_TAX", "Groceries", "MEDIUM"),
        createTransaction(5, "Home Depot", 156.00, SF_SALES_TAX, "SALES_TAX", "Home improvement", "HIGH"),

        // 6 DAYS AGO
        createTransaction(6, "Best Buy", 299.00, SF_SALES_TAX, "SALES_TAX", "Headphones", "HIGH"),
        createTransaction(6, "PG&E", 145.00, 0, "OTHER", "Electricity bill", "MEDIUM"),

        // 1 WEEK AGO - Monthly bills
        createTransaction(7, "State Farm", 185.00, 0.035, "OTHER", "Car insurance premium", "HIGH"),
        createTransaction(7, "Kaiser Permanente", 450.00, 0, "OTHER", "Health insurance premium", "HIGH"),

        // 2 WEEKS AGO
        createTransaction(14, "Apple Store", 1099.00, SF_SALES_TAX, "SALES_TAX", "iPhone 15", "HIGH"),
        createTransaction(14, "Uniqlo", 89.00, SF_SALES_TAX, "SALES_TAX", "Clothing", "MEDIUM"),

        // 3 WEEKS AGO
        createTransaction(21, "REI", 245.00, SF_SALES_TAX, "SALES_TAX", "Outdoor gear", "MEDIUM"),
        createTransaction(21, "Comcast", 89.00, 0.08, "OTHER", "Internet bill", "MEDIUM"),

        // 1 MONTH AGO - Income tax payment
        createTransaction(30, "IRS", 2500.00, 0, "INCOME_TAX", "Q4 estimated tax payment", "HIGH"),
        createTransaction(30, "CA Franchise Tax Board", 850.00, 0, "INCOME_TAX", "CA state estimated tax", "HIGH"),
    ];

    let created = 0;
    for (const transaction of transactions) {
        const tx = await prisma.transaction.create({
            data: {
                userId,
                date: transaction.date,
                type: transaction.type,
                description: transaction.description,
                merchant: transaction.merchant,
                totalAmount: transaction.totalAmount,
                taxAmount: transaction.taxAmount,
                currency: "USD",
                priority: transaction.priority || "MEDIUM",
            },
        });
        console.log(`✓ ${tx.merchant}: $${tx.totalAmount.toFixed(2)} (tax: $${tx.taxAmount.toFixed(2)})`);
        created++;
    }

    console.log(`\n✅ Created ${created} transactions`);

    // Summary
    const totalSpent = transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
    const totalTax = transactions.reduce((sum, tx) => sum + tx.taxAmount, 0);
    console.log(`\n📊 Summary:`);
    console.log(`   Total spent: $${totalSpent.toFixed(2)}`);
    console.log(`   Total tax: $${totalTax.toFixed(2)}`);
    console.log(`   Effective rate: ${((totalTax / totalSpent) * 100).toFixed(2)}%`);
}

async function main() {
    // Find the first user in the database
    const user = await prisma.user.findFirst();

    if (!user) {
        console.error("❌ No user found. Please sign in first to create a user.");
        process.exit(1);
    }

    console.log(`Found user: ${user.email}\n`);

    // Optional: Clear existing transactions first
    const existing = await prisma.transaction.count({ where: { userId: user.id } });
    if (existing > 0) {
        console.log(`Clearing ${existing} existing transactions...`);
        await prisma.transaction.deleteMany({ where: { userId: user.id } });
    }

    await seedDemoData(user.id);

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
