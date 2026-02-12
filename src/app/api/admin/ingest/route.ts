import { NextRequest, NextResponse } from 'next/server';
import { ingestionQueue } from '@/lib/queue';
import { ingestRecentBills } from '@/lib/pipelines/ingest';

export const maxDuration = 300; // Allow up to 5 minutes

/**
 * POST /api/admin/ingest
 *
 * Triggers bill ingestion from Congress.gov API.
 *
 * Body params:
 *   mode?: 'direct' | 'queue' — direct runs synchronously and returns results (default: 'direct')
 *   limit?: number — number of bills to fetch (default: 20, max: 250)
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const mode = (body.mode as string) || 'direct';
        const limit = Math.min((body.limit as number) || 20, 250);

        if (mode === 'queue') {
            // Queue for background processing via Firestore task queue
            await ingestionQueue.add('daily-ingest', { limit }, {
                removeOnComplete: true,
                removeOnFail: false,
            });
            return NextResponse.json({
                success: true,
                mode: 'queue',
                message: 'Ingestion job queued for background processing.',
            });
        }

        // Direct mode: run synchronously and return results
        const result = await ingestRecentBills(limit);

        return NextResponse.json({
            success: true,
            mode: 'direct',
            message: `Ingestion complete. ${result.billsProcessed} bills processed, ${result.versionsCreated} versions created, ${result.textsDownloaded} texts downloaded, ${result.summariesQueued} summaries queued.`,
            ...result,
        });
    } catch (err: any) {
        console.error('Ingest route error:', err);
        return NextResponse.json({
            success: false,
            error: err.message,
        }, { status: 500 });
    }
}
