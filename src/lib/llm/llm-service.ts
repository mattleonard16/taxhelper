/**
 * LLM Service - OpenAI GPT-4 Integration
 * 
 * Context optimization patterns applied:
 * - Token budgeting: Limit input to essential text only
 * - Structured output: JSON response schema
 * - Retry logic: Handle rate limits gracefully
 */

import OpenAI from "openai";
import { LLM_CATEGORY_PROMPT, LLM_VALID_CATEGORY_CODES } from "@/lib/categories";

// Lazy initialization to avoid errors when API key is not set
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY environment variable is not set");
        }
        openaiClient = new OpenAI({ apiKey });
    }
    return openaiClient;
}

export interface ReceiptExtractionResult {
    merchant: string | null;
    date: string | null; // ISO format
    subtotal: number | null;
    tax: number | null;
    tip: number | null;
    total: number | null;
    currency: string;
    paymentMethod: string | null;
    category: string | null;
    categoryCode: string | null;
    isDeductible: boolean;
    confidence: number; // 0-1
    lineItems: Array<{
        description: string;
        quantity: number;
        unitPrice: number | null;
        total: number | null;
    }>;
}

const EXTRACTION_SYSTEM_PROMPT = `You are a receipt data extraction assistant. Extract structured data from receipt text.

IMPORTANT: Return ONLY valid JSON. No markdown, no explanation.

Output schema:
{
  "merchant": "string or null",
  "date": "YYYY-MM-DD or null",
  "subtotal": number or null,
  "tax": number or null,
  "tip": number or null,
  "total": number or null,
  "currency": "USD",
  "paymentMethod": "visa|mastercard|amex|cash|debit|null",
  "category": "Meals & Entertainment|Travel|Office Supplies|Utilities|Professional Services|Software & Subscriptions|Groceries|Healthcare|Other",
  "categoryCode": "${LLM_VALID_CATEGORY_CODES.join('|')}",
  "isDeductible": boolean,
  "confidence": 0.0 to 1.0,
  "lineItems": [{"description": "", "quantity": 1, "unitPrice": null, "total": null}]
}

${LLM_CATEGORY_PROMPT}`;

/**
 * Extract structured data from receipt text using GPT-4
 * 
 * @param ocrText - Raw OCR text from receipt (max 1500 chars for token efficiency)
 * @returns Extracted receipt data with confidence score
 */
export async function extractReceiptData(
    ocrText: string
): Promise<ReceiptExtractionResult> {
    const openai = getOpenAI();

    // Context optimization: Truncate to 1500 chars (approx 375 tokens)
    const truncatedText = ocrText.slice(0, 1500);

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Cost-effective for structured extraction
        messages: [
            { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
            { role: "user", content: `Extract data from this receipt:\n\n${truncatedText}` },
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 500,
        response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error("No response from LLM");
    }

    try {
        const parsed = JSON.parse(content) as ReceiptExtractionResult;
        return {
            merchant: parsed.merchant || null,
            date: parsed.date || null,
            subtotal: parsed.subtotal ?? null,
            tax: parsed.tax ?? null,
            tip: parsed.tip ?? null,
            total: parsed.total ?? null,
            currency: parsed.currency || "USD",
            paymentMethod: parsed.paymentMethod || null,
            category: parsed.category || "Other",
            categoryCode: parsed.categoryCode || "OTHER",
            isDeductible: parsed.isDeductible ?? false,
            confidence: parsed.confidence ?? 0.5,
            lineItems: parsed.lineItems || [],
        };
    } catch {
        throw new Error(`Failed to parse LLM response: ${content}`);
    }
}

/**
 * Verify and validate extracted receipt data
 * 
 * @param extracted - Previously extracted data
 * @param ocrText - Original OCR text for reference
 * @returns Verification result with any corrections
 */
export async function verifyReceiptData(
    extracted: ReceiptExtractionResult,
    ocrText: string
): Promise<{
    isValid: boolean;
    issues: string[];
    corrected: ReceiptExtractionResult | null;
}> {
    const openai = getOpenAI();

    const truncatedText = ocrText.slice(0, 1000); // Less context needed for verification

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You verify receipt extractions. Check if the extracted data matches the original text.
Return JSON: {"isValid": boolean, "issues": ["issue1", "issue2"], "corrections": {...} or null}`
            },
            {
                role: "user",
                content: `Extracted data:\n${JSON.stringify(extracted, null, 2)}\n\nOriginal text:\n${truncatedText}`
            },
        ],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        return { isValid: true, issues: [], corrected: null };
    }

    try {
        const result = JSON.parse(content);
        return {
            isValid: result.isValid ?? true,
            issues: result.issues || [],
            corrected: result.corrections ? { ...extracted, ...result.corrections } : null,
        };
    } catch {
        return { isValid: true, issues: [], corrected: null };
    }
}
