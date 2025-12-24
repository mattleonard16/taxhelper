# TaxHelper: Enhanced Dashboard with LLM Data

## Objective
Enhance the dashboard to display receipt categorization data, deductible expense tracking, and confidence scores from GPT-4 extracted receipts.

## Current State
- Dashboard shows basic tax stats (total tax, spending, transaction counts)
- Receipt processing extracts: merchant, date, tax, total, category, categoryCode, isDeductible, confidence
- These fields exist in ReceiptExtraction but are NOT persisted or displayed

## Required Changes

### 1. Database Schema Update
Add category and deductibility tracking to ReceiptJob model:

**File**: `prisma/schema.prisma`
- Add `category String?` to ReceiptJob
- Add `categoryCode String?` to ReceiptJob  
- Add `isDeductible Boolean @default(false)` to ReceiptJob
- Add `extractionConfidence Float?` to ReceiptJob

Run: `npx prisma migrate dev --name add_category_fields`

### 2. Update Receipt Worker
**File**: `src/lib/receipt/receipt-job-worker.ts`
- After LLM extraction, persist category/isDeductible to ReceiptJob
- Store confidence score

### 3. Update Stats API
**File**: `src/app/api/receipts/stats/route.ts`
- Group by category and sum amounts
- Calculate total deductible amount
- Return category breakdown

New response shape:
```json
{
  "receipts": { "total": 10, "processed": 8, "pending": 1, "failed": 1 },
  "tax": { "totalPaid": "150.00", "totalSpent": "1800.00" },
  "deductions": { "total": "540.00", "count": 5 },
  "categories": [
    { "category": "Meals & Entertainment", "categoryCode": "MEALS", "amount": 250.00, "count": 4 },
    { "category": "Travel", "categoryCode": "TRAVEL", "amount": 180.00, "count": 2 }
  ],
  "avgConfidence": 0.87
}
```

### 4. New Dashboard Components
**File**: `src/components/dashboard/category-breakdown-chart.tsx`
- Pie chart showing expense distribution by category
- Use Recharts PieChart component
- Color-coded by category

**File**: `src/components/dashboard/deductible-summary.tsx`
- Card showing total deductible expenses
- Percentage of spending that's deductible
- Count of deductible receipts

**File**: Update `src/components/dashboard/receipt-orchestration-stats.tsx`
- Add average confidence indicator
- Show category icons

### 5. Update Dashboard Page
**File**: `src/app/(app)/dashboard/page.tsx`
- Import and render new components
- Fetch category breakdown from stats API

## Verification
1. Upload a receipt via `/api/receipts/upload`
2. Process with `/api/receipts/process`
3. Check dashboard shows category breakdown
4. Verify deductible total is accurate
