import { NextRequest, NextResponse } from 'next/server';
import { epsteinDocuments } from '@/lib/db';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const document = await epsteinDocuments.findById(id);

    if (!document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ document });
}
