-- AlterEnum
ALTER TYPE "InsightType" ADD VALUE 'DEDUCTION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hasHealthInsurance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFreelancer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "worksFromHome" BOOLEAN NOT NULL DEFAULT false;
