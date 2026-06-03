-- CreateTable
CREATE TABLE "Lab" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "labId" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" SERIAL NOT NULL,
    "requestCode" TEXT NOT NULL,
    "sampleName" TEXT NOT NULL,
    "crop" TEXT,
    "season" TEXT,
    "year" INTEGER,
    "program" TEXT,
    "purpose" TEXT,
    "materialStage" TEXT,
    "project" TEXT,
    "projectCode" TEXT,
    "testType" TEXT NOT NULL,
    "analysisToBeDone" TEXT,
    "traitGene" TEXT,
    "markersPerSample" INTEGER,
    "predictedSamples" INTEGER,
    "actualSamples" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedByDate" TIMESTAMP(3) NOT NULL,
    "tentativeSamplingDate" TIMESTAMP(3),
    "dateOfSampling" TIMESTAMP(3),
    "dateOfDispatch" TIMESTAMP(3),
    "dodCommittedByLab" TIMESTAMP(3),
    "dnaExtractionDate" TIMESTAMP(3),
    "genotypingDate" TIMESTAMP(3),
    "resultsCommunicationDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "currentPhase" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "submittedById" INTEGER NOT NULL,
    "assignedLabId" INTEGER,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseHistory" (
    "id" SERIAL NOT NULL,
    "phase" TEXT NOT NULL,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" INTEGER NOT NULL,

    CONSTRAINT "PhaseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "minThreshold" DOUBLE PRECISION NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "lowStockThreshold" DOUBLE PRECISION,
    "labId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReagentLog" (
    "id" SERIAL NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL,
    "purpose" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,
    "requestId" INTEGER,
    "usedById" INTEGER NOT NULL,

    CONSTRAINT "ReagentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransfer" (
    "id" SERIAL NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fromItemId" INTEGER NOT NULL,
    "toItemId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentItem" (
    "id" SERIAL NOT NULL,
    "experimentId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,

    CONSTRAINT "ExperimentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "detail" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" INTEGER NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Request_requestCode_key" ON "Request"("requestCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_assignedLabId_fkey" FOREIGN KEY ("assignedLabId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseHistory" ADD CONSTRAINT "PhaseHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReagentLog" ADD CONSTRAINT "ReagentLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReagentLog" ADD CONSTRAINT "ReagentLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReagentLog" ADD CONSTRAINT "ReagentLog_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_fromItemId_fkey" FOREIGN KEY ("fromItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_toItemId_fkey" FOREIGN KEY ("toItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentItem" ADD CONSTRAINT "ExperimentItem_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentItem" ADD CONSTRAINT "ExperimentItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
