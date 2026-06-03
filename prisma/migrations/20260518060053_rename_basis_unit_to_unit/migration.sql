/*
  Warnings:

  - You are about to drop the column `basisUnit` on the `ConsumptionCluster` table. All the data in the column will be lost.
  - You are about to drop the column `deductedAt` on the `ConsumptionDeduction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ConsumptionCluster" DROP COLUMN "basisUnit",
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'sample';

-- AlterTable
ALTER TABLE "ConsumptionDeduction" DROP COLUMN "deductedAt",
ADD COLUMN     "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
