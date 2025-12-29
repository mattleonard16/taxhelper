---
name: receipt-processing
description: Receipt OCR extraction, LLM fallback, and job pipeline patterns for TaxHelper. Use when working on receipt upload, extraction, inbox, or transaction creation from receipts.
---

# Receipt Processing Skill

This skill provides guidance for the receipt processing pipeline in TaxHelper.

## When to Use This Skill

- Modifying receipt upload or extraction logic
- Working on the receipt inbox UI
- Updating OCR or LLM extraction
- Handling receipt job status transitions
- Creating transactions from confirmed receipts

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Upload Flow                               │
│  User uploads → Storage → ReceiptJob (QUEUED) → Worker picks up │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Extraction Pipeline                          │
│  Tesseract OCR → Parse text → Confidence check → LLM fallback   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Inbox Flow                                │
│  NEEDS_REVIEW / COMPLETED → User edits → Confirm → Transaction  │
└─────────────────────────────────────────────────────────────────┘
```

## Domain Files

```
src/lib/receipt/
├── index.ts                    # Public API exports
├── receipt-extraction.ts       # Hybrid OCR + LLM extraction
├── receipt-ocr.ts              # Tesseract text parsing
├── receipt-llm.ts              # Vision LLM extraction
├── receipt-cache.ts            # Extraction result caching
├── receipt-storage.ts          # File storage (local/.receipt-storage)
├── receipt-job-repository.ts   # Database access layer
├── receipt-jobs-service.ts     # Business logic + status machine
├── receipt-job-worker.ts       # Background worker
├── receipt-utils.ts            # Shared utilities
└── __tests__/                  # Co-located tests
```

## Job Status Machine

```
QUEUED ──worker──▶ PROCESSING ──success──▶ COMPLETED (confidence ≥ 0.7)
   │                    │                         │
   │                    │                         ▼
   │                    │               NEEDS_REVIEW (confidence < 0.7)
   │                    │                         │
   │                    ▼                         ▼
   │                 FAILED ◀──────────── User edits ──▶ CONFIRMED
   │                    │                                    │
   │                    ▼                                    ▼
   │              retry ──▶ QUEUED                    Transaction created
   │                                                         │
   └─────────────────────────────────────────────────────────┘
```

### Status Definitions

| Status | Description | User Action |
|--------|-------------|-------------|
| `QUEUED` | Waiting for worker | None |
| `PROCESSING` | Worker extracting data | None |
| `NEEDS_REVIEW` | Low confidence, user must review | Edit fields, then confirm |
| `COMPLETED` | High confidence, ready to confirm | Review, then confirm |
| `CONFIRMED` | Transaction created, immutable | View linked transaction |
| `FAILED` | Extraction failed | Retry or discard |

### Confidence Threshold

```typescript
const CONFIDENCE_THRESHOLD = 0.7;

function determineStatusFromConfidence(confidence: number | null): "NEEDS_REVIEW" | "COMPLETED" {
  if (confidence === null || confidence < CONFIDENCE_THRESHOLD) {
    return "NEEDS_REVIEW";
  }
  return "COMPLETED";
}
```

## Extraction Pipeline

### Hybrid Strategy

1. **Tesseract OCR first**: Fast, runs on all images
2. **Confidence check**: If < 0.7, try LLM
3. **LLM fallback**: Uses vision model for better extraction
4. **Merge results**: Combine best of both

```typescript
// src/lib/receipt/receipt-extraction.ts
export async function extractReceiptData(input: ReceiptExtractionInput): Promise<ReceiptExtraction> {
  // Try Tesseract first
  const tesseractResult = input.ocrText
    ? parseReceiptOCR(input.ocrText, { ocrConfidence: input.ocrConfidence })
    : createEmptyReceiptExtraction();

  // If good enough, return early
  if (tesseractResult.confidence >= LLM_FALLBACK_CONFIDENCE) {
    return tesseractResult;
  }

  // Try LLM if available
  if (input.image && input.mimeType && isLLMConfigured()) {
    const llmResult = await extractReceiptWithLLM({ image, mimeType });
    return mergeReceiptExtractions(llmResult, tesseractResult);
  }

  return tesseractResult;
}
```

### ReceiptExtraction Interface

```typescript
interface ReceiptExtraction {
  merchant: string | null;
  date: string | null;           // ISO date string (YYYY-MM-DD)
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  items: ReceiptItem[];
  confidence: number;            // 0-1 score
  // LLM-powered categorization
  category?: string;             // "Meals & Entertainment"
  categoryCode?: string;         // "MEALS"
  isDeductible?: boolean;
}

interface ReceiptItem {
  description: string;
  quantity?: number | null;
  unitPrice?: number | null;
  total?: number | null;
}
```

### Confidence Calculation

Weighted scoring based on extracted fields:

```typescript
const weights = {
  merchant: 0.2,
  date: 0.15,
  total: 0.3,
  tax: 0.1,
  subtotal: 0.1,
  items: 0.15,
};

// Data completeness (80%) + OCR quality (20%)
const combined = dataScore * 0.8 + normalizedOcrConfidence * 0.2;
```

## OCR Parsing Patterns

### Text Extraction

```typescript
// Extract total
const patterns = [
  /(?:total|amount|balance)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
  /\$\s*([\d,]+\.\d{2})\s*$/m,
];

// Extract date
const patterns = [
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,   // MM/DD/YYYY
  /([A-Za-z]{3,}\s+\d{1,2},?\s+\d{2,4})/,  // March 15, 2024
  /(\d{4}-\d{2}-\d{2})/,                    // ISO format
];

// Extract merchant (first non-metadata line)
for (const line of lines.slice(0, 5)) {
  if (!isPhoneNumber(line) && !isZipCode(line) && !isPrice(line)) {
    return line;
  }
}
```

## Service Layer Patterns

### ServiceResult Type

All service functions return this type:

```typescript
type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

// Usage
const result = await confirmJob(userId, jobId);
if (!result.success) {
  return ApiErrors.validation(result.error);
}
return NextResponse.json(result.data);
```

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `NOT_FOUND` | 404 | Job doesn't exist or not owned |
| `INVALID_STATUS` | 400 | Operation not allowed in current status |
| `VALIDATION_ERROR` | 400 | Missing or invalid fields |
| `CONFLICT` | 409 | Concurrent modification |

## Confirm Flow (Critical Path)

The confirm operation is **idempotent** and **concurrency-safe**:

```typescript
export async function confirmJob(userId: string, jobId: string): Promise<ServiceResult<{ transactionId: string }>> {
  // 1. Fetch and validate
  const job = await prisma.receiptJob.findFirst({ where: { id: jobId, userId } });
  
  // 2. Idempotent: if already confirmed, return existing
  if (job.status === "CONFIRMED" && job.transactionId) {
    return { success: true, data: { transactionId: job.transactionId } };
  }
  
  // 3. Atomic transaction: claim + create + link
  await prisma.$transaction(async (tx) => {
    // Conditional claim (prevents race conditions)
    const claimed = await tx.receiptJob.updateMany({
      where: { id: jobId, transactionId: null, status: { in: ["NEEDS_REVIEW", "COMPLETED"] } },
      data: { status: "CONFIRMED" },
    });
    
    if (claimed.count === 0) throw new Error("CONFLICT");
    
    // Create transaction
    const transaction = await tx.transaction.create({ data: { ... } });
    
    // Link transaction to job
    await tx.receiptJob.update({
      where: { id: jobId },
      data: { transactionId: transaction.id },
    });
  });
}
```

## User Corrections Tracking

Track user edits for LLM fine-tuning:

```typescript
// When user patches a field
if (patch.merchant !== job.merchant) {
  await prisma.receiptCorrection.create({
    data: {
      receiptJobId: jobId,
      userId,
      fieldName: "merchant",
      originalValue: job.merchant,
      correctedValue: patch.merchant,
    },
  });
}
```

## Storage

Files stored in `.receipt-storage/[userId]/[jobId]/original.[ext]`

```typescript
// src/lib/receipt/receipt-storage.ts
export async function storeReceipt(userId: string, file: Buffer, options: StoreOptions): Promise<string> {
  const path = `${STORAGE_ROOT}/${userId}/${jobId}/original.${ext}`;
  await fs.writeFile(path, file);
  return path;
}

export async function getReceiptBuffer(storagePath: string): Promise<Buffer> {
  return fs.readFile(storagePath);
}

export async function deleteReceiptFiles(storagePath: string): Promise<void> {
  const dir = path.dirname(storagePath);
  await fs.rm(dir, { recursive: true });
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/receipts/upload` | POST | Upload receipt, create job |
| `/api/receipts/inbox` | GET | List jobs (NEEDS_REVIEW, COMPLETED, FAILED) |
| `/api/receipts/[id]` | GET | Get single job |
| `/api/receipts/[id]` | PATCH | Update extracted fields |
| `/api/receipts/[id]/confirm` | POST | Confirm and create transaction |
| `/api/receipts/[id]/retry` | POST | Retry failed job |
| `/api/receipts/[id]` | DELETE | Soft-delete (discard) |
| `/api/receipts/[id]/image` | GET | Serve receipt image |

## Testing

```bash
# Run all receipt tests
npm test -- src/lib/receipt/__tests__/

# Run specific test
npm test -- src/lib/receipt/__tests__/receipt-extraction.test.ts
```

### Test Patterns

```typescript
// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    receiptJob: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

// Test status transitions
it("moves NEEDS_REVIEW to CONFIRMED on confirm", async () => {
  mockJob({ status: "NEEDS_REVIEW", merchant: "Test", totalAmount: "10.00", date: new Date() });
  const result = await confirmJob(userId, jobId);
  expect(result.success).toBe(true);
});
```
