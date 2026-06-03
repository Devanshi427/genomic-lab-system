-- AlterTable
ALTER TABLE "ConsumptionCluster" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "snpCount" INTEGER,
ADD COLUMN     "ssrCount" INTEGER;
