-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "manufacturingDate" TIMESTAMP(3),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'CHEMICAL';

-- CreateTable
CREATE TABLE "ConsumptionCluster" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basisUnit" TEXT NOT NULL DEFAULT 'sample',
    "experimentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsumptionCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumptionClusterItem" (
    "id" SERIAL NOT NULL,
    "qtyPerUnit" DOUBLE PRECISION NOT NULL,
    "clusterId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,

    CONSTRAINT "ConsumptionClusterItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumptionDeduction" (
    "id" SERIAL NOT NULL,
    "units" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "deductedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clusterId" INTEGER NOT NULL,
    "performedById" INTEGER NOT NULL,

    CONSTRAINT "ConsumptionDeduction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConsumptionCluster" ADD CONSTRAINT "ConsumptionCluster_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionClusterItem" ADD CONSTRAINT "ConsumptionClusterItem_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ConsumptionCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionClusterItem" ADD CONSTRAINT "ConsumptionClusterItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionDeduction" ADD CONSTRAINT "ConsumptionDeduction_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ConsumptionCluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionDeduction" ADD CONSTRAINT "ConsumptionDeduction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
