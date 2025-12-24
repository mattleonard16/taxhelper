-- CreateTable
CREATE TABLE "ReceiptExtractionCache" (
    "hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptExtractionCache_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "LlmDailyUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalCostUsd" DECIMAL(10,6) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmDailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptExtractionCache_expiresAt_idx" ON "ReceiptExtractionCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LlmDailyUsage_userId_date_key" ON "LlmDailyUsage"("userId", "date");

-- CreateIndex
CREATE INDEX "LlmDailyUsage_userId_idx" ON "LlmDailyUsage"("userId");

-- AddForeignKey
ALTER TABLE "LlmDailyUsage" ADD CONSTRAINT "LlmDailyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
