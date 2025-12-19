import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Bay Area (San Francisco) tax rates
const SF_SALES_TAX = 0.08625; // 8.625%

interface TxInput {
    daysAgo: number;
    merchant: string;
    preTax: number;
    taxRate: number;
    type: "SALES_TAX" | "INCOME_TAX" | "OTHER";
    desc?: string;
}

function buildTx(input: TxInput) {
    const tax = input.preTax * input.taxRate;
    const total = input.preTax + tax;
    const date = new Date();
    date.setDate(date.getDate() - input.daysAgo);
    date.setHours(12, 0, 0, 0);

    return {
        date,
        type: input.type,
        description: input.desc || `Purchase at ${input.merchant}`,
        merchant: input.merchant,
        totalAmount: total,
        taxAmount: tax,
        currency: "USD",
    };
}

const txData: TxInput[] = [
    // TODAY - Typical day in SF
    { daysAgo: 0, merchant: "Starbucks", preTax: 6.50, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Morning coffee" },
    { daysAgo: 0, merchant: "Whole Foods", preTax: 45.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Groceries" },
    { daysAgo: 0, merchant: "Uber", preTax: 28.00, taxRate: 0, type: "OTHER", desc: "Ride to work" },
    { daysAgo: 0, merchant: "Chipotle", preTax: 15.50, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Lunch" },

    // YESTERDAY
    { daysAgo: 1, merchant: "Target", preTax: 89.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Household items" },
    { daysAgo: 1, merchant: "Shell Gas Station", preTax: 65.00, taxRate: 0.0511, type: "SALES_TAX", desc: "Gas" },
    { daysAgo: 1, merchant: "Amazon", preTax: 125.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Electronics" },

    // 2 DAYS AGO
    { daysAgo: 2, merchant: "Trader Joe's", preTax: 78.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Weekly groceries" },
    { daysAgo: 2, merchant: "Netflix", preTax: 22.99, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Streaming" },

    // 3 DAYS AGO
    { daysAgo: 3, merchant: "CVS Pharmacy", preTax: 35.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Medicine" },
    { daysAgo: 3, merchant: "DoorDash", preTax: 42.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Dinner delivery" },

    // 4 DAYS AGO
    { daysAgo: 4, merchant: "Costco", preTax: 285.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Bulk shopping" },
    { daysAgo: 4, merchant: "Spotify", preTax: 14.99, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Music sub" },

    // 5 DAYS AGO
    { daysAgo: 5, merchant: "Safeway", preTax: 62.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Groceries" },
    { daysAgo: 5, merchant: "Home Depot", preTax: 156.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Home improvement" },

    // 6 DAYS AGO
    { daysAgo: 6, merchant: "Best Buy", preTax: 299.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Headphones" },
    { daysAgo: 6, merchant: "PG&E", preTax: 145.00, taxRate: 0, type: "OTHER", desc: "Electric bill" },

    // 7 DAYS AGO - MONTHLY INSURANCE
    { daysAgo: 7, merchant: "State Farm", preTax: 185.00, taxRate: 0.035, type: "OTHER", desc: "Car insurance premium" },
    { daysAgo: 7, merchant: "Kaiser Permanente", preTax: 450.00, taxRate: 0, type: "OTHER", desc: "Health insurance" },

    // 2 WEEKS AGO
    { daysAgo: 14, merchant: "Apple Store", preTax: 1099.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "iPhone 15" },
    { daysAgo: 14, merchant: "Uniqlo", preTax: 89.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Clothing" },

    // 3 WEEKS AGO
    { daysAgo: 21, merchant: "REI", preTax: 245.00, taxRate: SF_SALES_TAX, type: "SALES_TAX", desc: "Outdoor gear" },
    { daysAgo: 21, merchant: "Comcast", preTax: 89.00, taxRate: 0.08, type: "OTHER", desc: "Internet" },

    // 1 MONTH AGO - TAX PAYMENTS
    { daysAgo: 30, merchant: "IRS", preTax: 2500.00, taxRate: 0, type: "INCOME_TAX", desc: "Q4 estimated tax" },
    { daysAgo: 30, merchant: "CA Franchise Tax Board", preTax: 850.00, taxRate: 0, type: "INCOME_TAX", desc: "CA state tax" },
];

async function main() {
    console.log("🔍 Finding user...");
    const user = await prisma.user.findFirst();

    if (!user) {
        console.error("❌ No user found. Sign in first.");
        process.exit(1);
    }

    console.log(`✓ Found user: ${user.email}`);

    // Clear existing
    const existing = await prisma.transaction.count({ where: { userId: user.id } });
    if (existing > 0) {
        console.log(`🗑️  Clearing ${existing} existing transactions...`);
        await prisma.transaction.deleteMany({ where: { userId: user.id } });
    }

    console.log("\n🌱 Seeding Bay Area transactions...\n");

    for (const input of txData) {
        const tx = buildTx(input);
        await prisma.transaction.create({
            data: { userId: user.id, ...tx },
        });
        console.log(`  ✓ ${tx.merchant}: $${tx.totalAmount.toFixed(2)} (tax: $${tx.taxAmount.toFixed(2)})`);
    }

    const transactions = txData.map(buildTx);
    const totalSpent = transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
    const totalTax = transactions.reduce((sum, tx) => sum + tx.taxAmount, 0);

    console.log("\n📊 Summary:");
    console.log(`   Total spent: $${totalSpent.toFixed(2)}`);
    console.log(`   Total tax: $${totalTax.toFixed(2)}`);
    console.log(`   Effective rate: ${((totalTax / totalSpent) * 100).toFixed(2)}%`);
    console.log("\n✅ Done! Refresh your dashboard.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
