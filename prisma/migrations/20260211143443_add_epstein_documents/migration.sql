-- CreateTable
CREATE TABLE "EpsteinDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "documentType" TEXT,
    "fileType" TEXT NOT NULL DEFAULT 'pdf',
    "pageCount" INTEGER,
    "rawText" TEXT,
    "summary" TEXT,
    "caseNumber" TEXT,
    "filedDate" TIMESTAMP(3),
    "parties" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpsteinDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EpsteinDocument_sourceUrl_key" ON "EpsteinDocument"("sourceUrl");

-- CreateIndex
CREATE INDEX "EpsteinDocument_status_idx" ON "EpsteinDocument"("status");

-- CreateIndex
CREATE INDEX "EpsteinDocument_documentType_idx" ON "EpsteinDocument"("documentType");
