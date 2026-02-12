import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextResponse } from 'next/server';

// Use the Edge-compatible auth config (no Prisma adapter).
// The JWT is decoded using AUTH_SECRET alone — no DB calls needed.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const { pathname } = req.nextUrl;

    // Protect admin routes — require auth + admin role
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        if (!req.auth) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const signInUrl = new URL('/auth/signin', req.url);
            signInUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(signInUrl);
        }

        // Check role from JWT (refreshed from DB in jwt callback on API routes)
        const role = (req.auth as { user?: { role?: string } })?.user?.role;
        if (role !== 'admin') {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
            }
            const url = new URL('/', req.url);
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
