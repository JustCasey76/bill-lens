import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await auth();
    return NextResponse.json({
        authenticated: !!session,
        session: session ? {
            user: {
                name: session.user?.name,
                email: session.user?.email,
                role: (session.user as { role?: string })?.role,
                id: (session.user as { id?: string })?.id,
            },
            expires: session.expires,
        } : null,
    });
}
