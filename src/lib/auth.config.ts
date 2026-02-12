import Google from 'next-auth/providers/google';
import type { NextAuthConfig } from 'next-auth';

/**
 * Auth config shared between the full auth (with Prisma adapter) and
 * the middleware (Edge-compatible, no Prisma).
 *
 * These callbacks only read from the JWT — no DB calls.
 * The full auth.ts overrides these callbacks with Prisma-enhanced versions.
 */
export const authConfig = {
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET,
        }),
    ],
    trustHost: true,
    session: {
        strategy: 'jwt',
    },
    callbacks: {
        // Pass role and userId from JWT token to session (no DB call)
        async jwt({ token }) {
            // In middleware context, just pass through — role was set by the full auth.ts jwt callback
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as string;
                session.user.id = token.userId as string;
            }
            return session;
        },
    },
    pages: {
        signIn: '/auth/signin',
    },
} satisfies NextAuthConfig;
