/**
 * Quick test script for LLM receipt extraction
 * Run with: npx tsx scripts/test-llm-receipt.ts
 */

import { config } from "dotenv";
config(); // Load .env file

import { extractReceiptData } from "../src/lib/llm/llm-service";

const SAMPLE_RECEIPT_TEXT = `
STARBUCKS
Store #12345
123 Main Street
New York, NY 10001

Date: 12/21/2024 10:35 AM

Caffe Latte Grande      $5.75
Blueberry Muffin        $3.95
Subtotal                $9.70
Tax (8.875%)            $0.86
Total                   $10.56

VISA ending 4242
Thank you for visiting!
`;

async function main() {
    console.log("Testing LLM Receipt Extraction...\n");
    console.log("Input text:");
    console.log(SAMPLE_RECEIPT_TEXT);
    console.log("\n--- Calling GPT-4 ---\n");

    try {
        const result = await extractReceiptData(SAMPLE_RECEIPT_TEXT);
        console.log("Extracted data:");
        console.log(JSON.stringify(result, null, 2));
        console.log("\n✅ LLM extraction successful!");
    } catch (error) {
        console.error("❌ LLM extraction failed:", error);
        process.exit(1);
    }
}

main();
