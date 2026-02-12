import { NextRequest, NextResponse } from 'next/server';
import { runDiscovery, type DiscoverySource } from '@/lib/epstein/discovery';
import { processAllPending } from '@/lib/epstein/extract';

export const maxDuration = 300; // Allow up to 5 minutes

/**
 * POST /api/admin/epstein-scrape
 *
 * Runs the discovery pipeline (find URLs) and optionally the extraction
 * pipeline (fetch + extract text, no file storage).
 *
 * Body params:
 *   sources?: ('hub-scrape' | 'sitemap-parse' | 'ia-cdx' | 'all')[]
 *   extract?: boolean — also process pending documents after discovery
 *   maxHubs?: number
 *   delayMs?: number
 *   maxExtract?: number — max documents to extract in this run
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const sources = (body.sources as DiscoverySource[] | undefined) ?? ['all'];
        const shouldExtract = body.extract !== false; // default: true
        const maxHubs = body.maxHubs as number | undefined;
        const delayMs = body.delayMs as number | undefined;
        const maxExtract = (body.maxExtract as number | undefined) ?? 100;

        // Phase 1: Discovery (find URLs)
        const discoveryResult = await runDiscovery({
            sources,
            maxHubs,
            delayMs,
        });

        // Phase 2: Extraction (fetch + extract text, no file storage)
        let extractionResult = null;
        if (shouldExtract && discoveryResult.newDocuments > 0) {
            extractionResult = await processAllPending({
                maxDocuments: maxExtract,
                delayMs: delayMs ?? 2000,
            });
        }

        return NextResponse.json({
            success: true,
            discovery: {
                runId: discoveryResult.runId,
                totalDiscovered: discoveryResult.totalDiscovered,
                newDocuments: discoveryResult.newDocuments,
                existingUpdated: discoveryResult.existingUpdated,
                aliasesCreated: discoveryResult.aliasesCreated,
                errors: discoveryResult.errors,
                bySource: discoveryResult.bySource,
            },
            extraction: extractionResult ? {
                processed: extractionResult.processed,
                errors: extractionResult.errors,
            } : null,
            message: `Discovery: ${discoveryResult.newDocuments} new URLs found. ${extractionResult ? `Extraction: ${extractionResult.processed} documents processed.` : 'Extraction skipped.'}`,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
