-- AlterTable
ALTER TABLE "ConsumptionDeduction" ADD COLUMN     "requestId" INTEGER;

-- AddForeignKey
ALTER TABLE "ConsumptionDeduction" ADD CONSTRAINT "ConsumptionDeduction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
