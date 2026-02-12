import { NextRequest, NextResponse } from 'next/server';
import { claims, bills } from '@/lib/db';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const result = await claims.findByIdWithBill(id);

    if (!result) {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const { claim, bill } = result;

    return NextResponse.json({
        claim: {
            ...claim,
            bill: bill ? {
                id: bill.id,
                congress: bill.congress,
                type: bill.type,
                number: bill.number,
                title: bill.title,
                status: bill.status,
            } : null,
        },
    });
}
