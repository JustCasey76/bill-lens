-- AlterTable: Add new columns to EpsteinDocument
ALTER TABLE "EpsteinDocument" ADD COLUMN "canonicalUrl" TEXT;
ALTER TABLE "EpsteinDocument" ADD COLUMN "finalUrl" TEXT;
ALTER TABLE "EpsteinDocument" ADD COLUMN "contentType" TEXT;
ALTER TABLE "EpsteinDocument" ADD COLUMN "lengthChars" INTEGER;
ALTER TABLE "EpsteinDocument" ADD COLUMN "textHash" TEXT;
ALTER TABLE "EpsteinDocument" ADD COLUMN "byteHash" TEXT;
ALTER TABLE "EpsteinDocument" ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "EpsteinDocument" ADD COLUMN "entities" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "EpsteinDocument" ADD COLUMN "httpEtag" TEXT;
ALTER TABLE "EpsteinDocument" ADD COLUMN "httpLastModified" TEXT;
ALTER TABLE "EpsteinDocument" ADD COLUMN "lastFetchedAt" TIMESTAMP(3);
ALTER TABLE "EpsteinDocument" ADD COLUMN "extractionQuality" DOUBLE PRECISION;
ALTER TABLE "EpsteinDocument" ADD COLUMN "ocrRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EpsteinDocument" ADD COLUMN "discoveryLineage" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "EpsteinDocument_canonicalUrl_key" ON "EpsteinDocument"("canonicalUrl");
CREATE INDEX "EpsteinDocument_byteHash_idx" ON "EpsteinDocument"("byteHash");
CREATE INDEX "EpsteinDocument_textHash_idx" ON "EpsteinDocument"("textHash");

-- Backfill canonicalUrl from sourceUrl for existing rows
UPDATE "EpsteinDocument" SET "canonicalUrl" = "sourceUrl" WHERE "canonicalUrl" IS NULL;

-- CreateTable: UrlAlias
CREATE TABLE "UrlAlias" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "aliasUrl" TEXT NOT NULL,
    "discoverySource" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UrlAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UrlAlias_aliasUrl_key" ON "UrlAlias"("aliasUrl");
CREATE INDEX "UrlAlias_documentId_idx" ON "UrlAlias"("documentId");

ALTER TABLE "UrlAlias" ADD CONSTRAINT "UrlAlias_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "EpsteinDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: DiscoveryRun
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "config" JSONB,
    "urlsFound" INTEGER NOT NULL DEFAULT 0,
    "urlsNew" INTEGER NOT NULL DEFAULT 0,
    "urlsChanged" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- Weighted full-text search: generated tsvector column + GIN index
-- This gives title matches higher weight than summary, which ranks above body text
ALTER TABLE "EpsteinDocument" ADD COLUMN "searchVector" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("summary", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("rawText", '')), 'C')
    ) STORED;

CREATE INDEX "EpsteinDocument_searchVector_idx" ON "EpsteinDocument" USING GIN("searchVector");
