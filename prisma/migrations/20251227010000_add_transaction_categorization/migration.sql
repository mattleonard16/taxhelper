-- Add categorization fields to Transaction
ALTER TABLE "Transaction" ADD COLUMN "category" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "categoryCode" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "isDeductible" BOOLEAN NOT NULL DEFAULT false;

-- Add indexes for filtering
CREATE INDEX "Transaction_isDeductible_idx" ON "Transaction"("isDeductible");
CREATE INDEX "Transaction_userId_isDeductible_idx" ON "Transaction"("userId", "isDeductible");
CREATE INDEX "Transaction_userId_merchant_idx" ON "Transaction"("userId", "merchant");
