/**
 * Hybrid receipt extraction: OCR first, LLM fallback for low confidence.
 */

import { logger } from '@/lib/logger';
import { createEmptyReceiptExtraction, parseReceiptOCR, ReceiptExtraction } from './receipt-ocr';
import { extractReceiptWithLLM, isLLMConfigured, isLLMImageTypeSupported } from './receipt-llm';

export interface ReceiptExtractionInput {
    ocrText?: string | null;
    ocrConfidence?: number | null;
    image?: ArrayBuffer | null;
    mimeType?: string | null;
    requestId?: string;
    userId?: string;
}

const LLM_FALLBACK_CONFIDENCE = 0.7;

export async function extractReceiptData(input: ReceiptExtractionInput): Promise<ReceiptExtraction> {
    const tesseractResult = input.ocrText
        ? parseReceiptOCR(input.ocrText, { ocrConfidence: input.ocrConfidence })
        : createEmptyReceiptExtraction();

    if (tesseractResult.confidence >= LLM_FALLBACK_CONFIDENCE) {
        return tesseractResult;
    }

    if (!input.image || !input.mimeType) {
        return tesseractResult;
    }

    if (!isLLMConfigured()) {
        return tesseractResult;
    }

    if (!isLLMImageTypeSupported(input.mimeType)) {
        return tesseractResult;
    }

    try {
        const llmResult = await extractReceiptWithLLM({
            image: input.image,
            mimeType: input.mimeType,
            requestId: input.requestId,
            userId: input.userId,
        });

        return mergeReceiptExtractions(llmResult, tesseractResult);
    } catch (error) {
        logger.warn('Receipt LLM extraction failed, using OCR fallback', {
            requestId: input.requestId,
            userId: input.userId,
            error,
        });
        return tesseractResult;
    }
}

function mergeReceiptExtractions(primary: ReceiptExtraction, fallback: ReceiptExtraction): ReceiptExtraction {
    return {
        merchant: primary.merchant ?? fallback.merchant,
        date: primary.date ?? fallback.date,
        subtotal: primary.subtotal ?? fallback.subtotal,
        tax: primary.tax ?? fallback.tax,
        total: primary.total ?? fallback.total,
        items: primary.items.length > 0 ? primary.items : fallback.items,
        category: primary.category ?? fallback.category,
        categoryCode: primary.categoryCode ?? fallback.categoryCode,
        isDeductible: primary.isDeductible ?? fallback.isDeductible,
        confidence: Math.max(primary.confidence, fallback.confidence),
    };
}
