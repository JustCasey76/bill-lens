import { NextRequest, NextResponse } from 'next/server';
import { epsteinDocuments } from '@/lib/db';

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const docType = searchParams.get('type');
    const limit = 20;
    const offset = (page - 1) * limit;

    if (q && q.trim().length > 0) {
        // Full-text search using tokenized searchTerms in Firestore
        const { documents, total } = await epsteinDocuments.search(q, {
            status: 'indexed',
            documentType: docType || undefined,
            limit,
            offset,
        });

        return NextResponse.json({
            documents: documents.map(doc => ({
                id: doc.id,
                title: doc.title,
                sourceUrl: doc.sourceUrl,
                documentType: doc.documentType,
                pageCount: doc.pageCount,
                summary: doc.summary,
                filedDate: doc.filedDate,
                status: doc.status,
                createdAt: doc.createdAt,
                extractionQuality: doc.extractionQuality,
                ocrRequired: doc.ocrRequired,
            })),
            total,
            page,
            query: q,
        });
    }

    // Default: return all indexed documents with optional type filter
    const where: any = { status: 'indexed' };
    if (docType) where.documentType = docType;

    const [documents, total] = await Promise.all([
        epsteinDocuments.findMany({
            where,
            orderBy: { field: 'createdAt', direction: 'desc' },
            take: limit,
            skip: offset,
            select: ['title', 'sourceUrl', 'documentType', 'pageCount', 'summary', 'filedDate', 'status', 'createdAt'],
        }),
        epsteinDocuments.count({ status: 'indexed' }),
    ]);

    return NextResponse.json({ documents, total, page });
}
