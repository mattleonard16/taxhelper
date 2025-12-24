// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReceiptExtraction } from "../receipt-ocr";
import { extractReceiptData } from "../receipt-extraction";
import {
  createEmptyReceiptExtraction,
  parseReceiptOCR,
} from "../receipt-ocr";
import {
  extractReceiptWithLLM,
  isLLMConfigured,
  isLLMImageTypeSupported,
} from "../receipt-llm";

vi.mock("../receipt-ocr", () => ({
  parseReceiptOCR: vi.fn(),
  createEmptyReceiptExtraction: vi.fn(),
}));

vi.mock("../receipt-llm", () => ({
  extractReceiptWithLLM: vi.fn(),
  isLLMConfigured: vi.fn(),
  isLLMImageTypeSupported: vi.fn(),
}));

describe("extractReceiptData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves LLM category fields when merging", async () => {
    const ocrExtraction: ReceiptExtraction = {
      merchant: "OCR Store",
      date: "2024-01-02",
      subtotal: 9,
      tax: 1,
      total: 10,
      items: [],
      confidence: 0.2,
    };

    const llmExtraction: ReceiptExtraction = {
      merchant: "LLM Store",
      date: "2024-01-01",
      subtotal: 12,
      tax: 1,
      total: 13,
      items: [],
      confidence: 0.4,
      category: "Meals & Entertainment",
      categoryCode: "MEALS",
      isDeductible: true,
    };

    vi.mocked(parseReceiptOCR).mockReturnValue(ocrExtraction);
    vi.mocked(createEmptyReceiptExtraction).mockReturnValue({
      merchant: null,
      date: null,
      subtotal: null,
      tax: null,
      total: null,
      items: [],
      confidence: 0,
    });
    vi.mocked(extractReceiptWithLLM).mockResolvedValue(llmExtraction);
    vi.mocked(isLLMConfigured).mockReturnValue(true);
    vi.mocked(isLLMImageTypeSupported).mockReturnValue(true);

    const result = await extractReceiptData({
      ocrText: "sample",
      ocrConfidence: 0.2,
      image: new ArrayBuffer(8),
      mimeType: "image/png",
    });

    expect(result.category).toBe("Meals & Entertainment");
    expect(result.categoryCode).toBe("MEALS");
    expect(result.isDeductible).toBe(true);
  });
});
