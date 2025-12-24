-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReceiptJobStatus') THEN
    CREATE TYPE "ReceiptJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Insight" ADD COLUMN IF NOT EXISTS "explanation" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReceiptJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReceiptJobStatus" NOT NULL DEFAULT 'QUEUED',
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "ocrText" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "merchant" TEXT,
    "date" TIMESTAMP(3),
    "totalAmount" DECIMAL(12,2),
    "taxAmount" DECIMAL(12,2),
    "items" JSONB,
    "currency" TEXT,
    "transactionId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "processingStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptJob_pkey" PRIMARY KEY ("id")
);

-- Ensure columns added when table already exists
ALTER TABLE "ReceiptJob" ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReceiptJob_userId_idx" ON "ReceiptJob"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReceiptJob_status_idx" ON "ReceiptJob"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReceiptJob_userId_status_idx" ON "ReceiptJob"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Insight_runId_idx" ON "Insight"("runId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Insight_type_idx" ON "Insight"("type");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReceiptJob_userId_fkey'
  ) THEN
    ALTER TABLE "ReceiptJob" ADD CONSTRAINT "ReceiptJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
