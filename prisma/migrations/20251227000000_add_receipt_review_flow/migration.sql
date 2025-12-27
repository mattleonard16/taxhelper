-- Add new receipt job statuses for review flow
ALTER TYPE "ReceiptJobStatus" ADD VALUE 'NEEDS_REVIEW';
ALTER TYPE "ReceiptJobStatus" ADD VALUE 'CONFIRMED';

-- Add unique constraint on transactionId to prevent duplicate transactions
ALTER TABLE "ReceiptJob" ADD CONSTRAINT "ReceiptJob_transactionId_key" UNIQUE ("transactionId");

-- Add composite index for inbox list queries
CREATE INDEX "ReceiptJob_userId_status_createdAt_idx" ON "ReceiptJob"("userId", "status", "createdAt");

-- Create ReceiptCorrection table for tracking user edits (LLM fine-tuning)
CREATE TABLE "ReceiptCorrection" (
    "id" TEXT NOT NULL,
    "receiptJobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "originalValue" TEXT,
    "correctedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptCorrection_pkey" PRIMARY KEY ("id")
);

-- Add indexes for ReceiptCorrection
CREATE INDEX "ReceiptCorrection_receiptJobId_idx" ON "ReceiptCorrection"("receiptJobId");
CREATE INDEX "ReceiptCorrection_userId_createdAt_idx" ON "ReceiptCorrection"("userId", "createdAt");

-- Add foreign key constraint
ALTER TABLE "ReceiptCorrection" ADD CONSTRAINT "ReceiptCorrection_receiptJobId_fkey" FOREIGN KEY ("receiptJobId") REFERENCES "ReceiptJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add soft-delete timestamp for discard
ALTER TABLE "ReceiptJob" ADD COLUMN "discardedAt" TIMESTAMP(3);
