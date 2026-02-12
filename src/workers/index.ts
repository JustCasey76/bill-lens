/**
 * Background task worker — Firestore-backed replacement for BullMQ workers.
 *
 * Polls the Firestore `taskQueue` collection for pending tasks and processes them.
 * In production on Firebase, this runs as a Cloud Function triggered by
 * Firestore document creation events. For local dev, run as a polling loop.
 *
 * Usage (local dev):
 *   npx tsx src/workers/index.ts
 */

import 'dotenv/config';
import { taskQueue, type TaskQueueItem } from '@/lib/db';
import { ingestRecentBills } from '@/lib/pipelines/ingest';
import { summarizeBillVersion } from '@/lib/pipelines/summarize';
import { checkClaim } from '@/lib/pipelines/claim-check';
import { processEpsteinDocument } from '@/lib/epstein/extract';
import { runDiscovery } from '@/lib/epstein/discovery';

const POLL_INTERVAL = 5000; // 5 seconds
const QUEUES = [
    'ingestion',
    'summary',
    'diff',
    'claim-check',
    'epstein-process',
    'epstein-discovery',
];

/**
 * Process a single task based on its queue and job name.
 */
async function processTask(task: TaskQueueItem): Promise<void> {
    console.log(`Processing [${task.queue}/${task.jobName}] task: ${task.id}`);

    switch (task.queue) {
        case 'ingestion': {
            const limit = task.data?.limit || 20;
            await ingestRecentBills(limit);
            break;
        }
        case 'summary': {
            await summarizeBillVersion(task.data.versionId);
            break;
        }
        case 'diff': {
            console.log('Diff processing not yet implemented');
            break;
        }
        case 'claim-check': {
            await checkClaim(task.data.claimId);
            break;
        }
        case 'epstein-process': {
            await processEpsteinDocument(task.data.url, task.data.title);
            break;
        }
        case 'epstein-discovery': {
            await runDiscovery({
                sources: task.data.sources,
                maxHubs: task.data.maxHubs,
                delayMs: task.data.delayMs,
            });
            break;
        }
        default:
            console.warn(`Unknown queue: ${task.queue}`);
    }
}

/**
 * Poll all queues and process one task at a time.
 */
async function pollOnce(): Promise<number> {
    let processed = 0;

    for (const queue of QUEUES) {
        const task = await taskQueue.claimNext(queue);
        if (!task) continue;

        try {
            await processTask(task);
            await taskQueue.complete(task.id);
            processed++;
            console.log(`Completed [${task.queue}/${task.jobName}]: ${task.id}`);
        } catch (err: any) {
            console.error(`Failed [${task.queue}/${task.jobName}]: ${err.message}`);
            await taskQueue.fail(task.id, err.message);
        }
    }

    return processed;
}

/**
 * Start the polling loop (for local development).
 * On Firebase, use Cloud Functions onDocumentCreated triggers instead.
 */
async function startPolling() {
    console.log('Worker polling started...');
    console.log(`Watching queues: ${QUEUES.join(', ')}`);
    console.log(`Poll interval: ${POLL_INTERVAL}ms`);

    while (true) {
        try {
            const processed = await pollOnce();
            if (processed > 0) {
                console.log(`Processed ${processed} task(s)`);
            }
        } catch (err) {
            console.error('Worker poll error:', err);
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
}

// Export for Cloud Functions integration
export { processTask, pollOnce };

// If run directly (local dev), start polling
if (require.main === module) {
    startPolling().catch(console.error);
}
