import { NextRequest, NextResponse } from 'next/server';
import { claims, bills } from '@/lib/db';
import { claimCheckQueue } from '@/lib/queue';
import { z } from 'zod';

const ClaimSubmitSchema = z.object({
    content: z.string().min(10, 'Claim must be at least 10 characters').max(2000),
    billId: z.string().optional(),
    sourceUrl: z.string().url().optional(),
});

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const verdict = searchParams.get('verdict');
    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 20;

    const where: any = {};
    if (status) where.status = status;
    if (verdict) where.verdict = verdict;
    if (q) where.contentContains = q;

    const [claimResults, total] = await Promise.all([
        claims.findMany({
            where,
            orderBy: { field: 'createdAt', direction: 'desc' },
            take: limit,
            skip: (page - 1) * limit,
        }),
        claims.count(where),
    ]);

    // Attach bill data to claims
    const claimsWithBills = await Promise.all(
        claimResults.map(async (claim) => {
            const bill = claim.billId ? await bills.findById(claim.billId) : null;
            return {
                ...claim,
                bill: bill ? {
                    id: bill.id,
                    congress: bill.congress,
                    type: bill.type,
                    number: bill.number,
                    title: bill.title,
                } : null,
            };
        })
    );

    return NextResponse.json({ claims: claimsWithBills, total, page });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = ClaimSubmitSchema.parse(body);

        const claim = await claims.create({
            content: parsed.content,
            billId: parsed.billId || null,
            sourceUrl: parsed.sourceUrl || null,
            status: 'pending',
        });

        await claimCheckQueue.add('check', { claimId: claim.id });

        return NextResponse.json({ claim, message: 'Claim submitted for fact-checking' }, { status: 201 });
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: err.issues }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to submit claim' }, { status: 500 });
    }
}
