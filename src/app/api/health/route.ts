import { NextResponse } from 'next/server';
import { checkConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const checks: Record<string, string> = {};

    // Check env vars
    checks.FIREBASE_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'MISSING';
    checks.OPENAI_API_KEY = process.env.OPENAI_API_KEY ? 'set' : 'MISSING';
    checks.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ? 'set (' + process.env.GOOGLE_CLIENT_ID.substring(0, 15) + '...)' : 'MISSING';
    checks.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ? 'set' : 'MISSING';
    checks.AUTH_SECRET = process.env.AUTH_SECRET ? 'set' : 'MISSING';
    checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'MISSING';
    checks.NODE_ENV = process.env.NODE_ENV || 'unknown';

    // Test Firestore connection
    try {
        const connected = await checkConnection();
        checks.database = connected ? 'connected (Firestore)' : 'FAILED';
    } catch (e: unknown) {
        checks.database = 'FAILED: ' + (e instanceof Error ? e.message : String(e));
    }

    return NextResponse.json(checks);
}
