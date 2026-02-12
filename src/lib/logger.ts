import { jobLogs } from './db';

export async function logJob(type: string, status: 'INFO' | 'SUCCESS' | 'ERROR', details: any) {
    console.log(`[${type}] ${status}:`, details);

    try {
        await jobLogs.create({
            jobType: type,
            status: status,
            details: typeof details === 'object' ? details : { message: details },
        });
    } catch (e) {
        console.error("Failed to write log to Firestore", e);
    }
}
