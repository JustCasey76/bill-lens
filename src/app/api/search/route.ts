import { NextRequest, NextResponse } from 'next/server';
import { bills, claims, epsteinDocuments } from '@/lib/db';

export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get('q');
    if (!q || q.trim().length < 2) {
        return NextResponse.json({ bills: [], claims: [], epsteinDocs: [] });
    }

    const [billResults, claimResults, epsteinResults] = await Promise.all([
        bills.findMany({
            where: { titleContains: q },
            take: 5,
        }),
        claims.findMany({
            where: { status: 'checked', contentContains: q },
            take: 5,
        }),
        epsteinDocuments.search(q, { status: 'indexed', limit: 5 }),
    ]);

    return NextResponse.json({
        bills: billResults.map((b) => ({
            id: b.id,
            congress: b.congress,
            type: b.type,
            number: b.number,
            title: b.title,
            status: b.status,
            url: `/bill/${b.congress}/${b.type}/${b.number}`,
        })),
        claims: claimResults.map((c) => ({
            id: c.id,
            content: c.content,
            verdict: c.verdict,
            url: `/claim/${c.id}`,
        })),
        epsteinDocs: epsteinResults.documents.map((d) => ({
            id: d.id,
            title: d.title,
            url: `/epstein-files/${d.id}`,
        })),
    });
}
