-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "approvalDate" TIMESTAMP(3),
ADD COLUMN     "approvalPriority" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
ADD COLUMN     "approvedById" INTEGER,
ADD COLUMN     "approvedSamples" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "queuePosition" INTEGER,
ADD COLUMN     "rejectedSamples" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "totalSamples" INTEGER;

-- CreateTable
CREATE TABLE "CapacityTracking" (
    "id" SERIAL NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "serviceType" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapacityTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CapacityTracking_weekStart_serviceType_key" ON "CapacityTracking"("weekStart", "serviceType");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
