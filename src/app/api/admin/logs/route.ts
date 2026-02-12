import { NextResponse } from 'next/server';
import { jobLogs } from '@/lib/db';

export async function GET() {
    try {
        const logs = await jobLogs.findMany({
            orderBy: { field: 'startedAt', direction: 'desc' },
            take: 50,
        });
        return NextResponse.json(logs);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }
}
