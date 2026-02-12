-- AlterTable: Add new columns to Bill
ALTER TABLE "Bill" ADD COLUMN "sponsorParty" TEXT;
ALTER TABLE "Bill" ADD COLUMN "sponsorState" TEXT;
ALTER TABLE "Bill" ADD COLUMN "policyArea" TEXT;
ALTER TABLE "Bill" ADD COLUMN "originChamber" TEXT;
ALTER TABLE "Bill" ADD COLUMN "congressGovUrl" TEXT;
ALTER TABLE "Bill" ADD COLUMN "latestActionDate" TIMESTAMP(3);
ALTER TABLE "Bill" ADD COLUMN "latestActionText" TEXT;
ALTER TABLE "Bill" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Bill_congress_idx" ON "Bill"("congress");
CREATE INDEX "Bill_policyArea_idx" ON "Bill"("policyArea");

-- AlterTable: Add new columns to BillAction
ALTER TABLE "BillAction" ADD COLUMN "actionType" TEXT;
ALTER TABLE "BillAction" ADD COLUMN "chamber" TEXT;

-- CreateIndex
CREATE INDEX "BillAction_billId_idx" ON "BillAction"("billId");
