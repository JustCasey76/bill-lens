/**
 * Task queue abstraction — Firestore-backed replacement for BullMQ/Redis.
 *
 * Uses Firestore's `taskQueue` collection to enqueue jobs.
 * Jobs are processed by Cloud Functions triggers or the poll-based worker.
 *
 * This keeps the same API surface as the old BullMQ queues so callers
 * don't need to change their `queue.add(...)` calls.
 */

import { taskQueue } from './db';

interface QueueLike {
    add(jobName: string, data: any, options?: { removeOnComplete?: boolean; removeOnFail?: boolean }): Promise<any>;
}

function createQueue(queueName: string): QueueLike {
    return {
        async add(jobName: string, data: any, options?: { removeOnComplete?: boolean; removeOnFail?: boolean }) {
            return taskQueue.add(queueName, jobName, data, {
                removeOnComplete: options?.removeOnComplete ?? true,
            });
        },
    };
}

export const ingestionQueue = createQueue('ingestion');
export const summaryQueue = createQueue('summary');
export const diffQueue = createQueue('diff');
export const claimCheckQueue = createQueue('claim-check');
export const epsteinProcessQueue = createQueue('epstein-process');
export const epsteinDiscoveryQueue = createQueue('epstein-discovery');
