-- AlterTable
ALTER TABLE "ReceiptJob" ADD COLUMN     "category" TEXT,
ADD COLUMN     "categoryCode" TEXT,
ADD COLUMN     "extractionConfidence" DOUBLE PRECISION,
ADD COLUMN     "isDeductible" BOOLEAN NOT NULL DEFAULT false;
