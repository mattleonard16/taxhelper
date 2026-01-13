-- Create TransactionPriority enum
CREATE TYPE "TransactionPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- Add priority column to Transaction table with default MEDIUM
ALTER TABLE "Transaction" ADD COLUMN "priority" "TransactionPriority" NOT NULL DEFAULT 'MEDIUM';

-- Create index on priority column for filtering
CREATE INDEX "Transaction_priority_idx" ON "Transaction"("priority");

-- Create composite index for priority filtering with user
CREATE INDEX "Transaction_userId_priority_idx" ON "Transaction"("userId", "priority");
