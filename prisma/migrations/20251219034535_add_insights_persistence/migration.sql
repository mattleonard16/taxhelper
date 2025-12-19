-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('QUIET_LEAK', 'TAX_DRAG', 'SPIKE', 'DUPLICATE');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "receiptName" TEXT,
ADD COLUMN     "receiptPath" TEXT;

-- CreateTable
CREATE TABLE "InsightRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "range" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" "InsightType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severityScore" INTEGER NOT NULL,
    "supportingTransactionIds" TEXT[],
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsightRun_userId_idx" ON "InsightRun"("userId");

-- CreateIndex
CREATE INDEX "InsightRun_userId_range_generatedAt_idx" ON "InsightRun"("userId", "range", "generatedAt");

-- AddForeignKey
ALTER TABLE "InsightRun" ADD CONSTRAINT "InsightRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InsightRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
