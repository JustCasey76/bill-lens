import { epsteinDocuments } from '@/lib/db';
import Link from 'next/link';
import { Search, FileText, BookOpen, ExternalLink, AlertTriangle } from 'lucide-react';
import { isFirestoreAvailable } from '@/lib/firestore';

export const dynamic = 'force-dynamic';

async function searchDocumentsFromFirestore(q: string, page: number) {
    const limit = 20;
    const offset = (page - 1) * limit;

    return epsteinDocuments.search(q, {
        status: 'indexed',
        limit,
        offset,
    });
}

export default async function EpsteinFilesPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; page?: string }>;
}) {
    const { q, page: pageStr } = await searchParams;
    const page = parseInt(pageStr || '1');

    let documents: any[] = [];
    let total = 0;

    let totalIndexed = 0;
    if (isFirestoreAvailable()) {
        try {
            if (q && q.trim().length > 0) {
                const result = await searchDocumentsFromFirestore(q, page);
                documents = result.documents;
                total = result.total;
                totalIndexed = await epsteinDocuments.count({ status: 'indexed' });
            } else {
                const [docs, count] = await Promise.all([
                    epsteinDocuments.findMany({
                        where: { status: 'indexed' },
                        orderBy: { field: 'createdAt', direction: 'desc' },
                        take: 20,
                        skip: (page - 1) * 20,
                        select: ['title', 'sourceUrl', 'documentType', 'pageCount', 'summary', 'filedDate', 'status', 'createdAt'],
                    }),
                    epsteinDocuments.count({ status: 'indexed' }),
                ]);
                documents = docs;
                total = count;
                totalIndexed = count;
            }
        } catch (e) {
            console.error('Failed to fetch Epstein documents:', e);
        }
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl text-white">
                        <BookOpen size={22} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Epstein Files</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Search declassified documents released by the DOJ
                        </p>
                    </div>
                </div>
            </div>

            {/* Context Banner */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-8">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">About these documents</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            These are official documents released by the U.S. Department of Justice. We index document metadata and text for search only; original PDFs stay on DOJ servers. Extracted text may contain OCR errors—refer to the source for legal accuracy.
                        </p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <form className="mb-8" action="/epstein-files" method="get">
                <div className="relative max-w-2xl">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        name="q"
                        defaultValue={q || ''}
                        placeholder='Search all documents... (e.g. "flight logs", "witness testimony")'
                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white shadow-sm"
                    />
                </div>
                {q && (
                    <p className="mt-3 text-sm text-slate-500">
                        {total} result{total !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
                    </p>
                )}
            </form>

            {/* Results */}
            {documents.length === 0 ? (
                <div className="text-center py-20 text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <BookOpen size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    {q ? (
                        totalIndexed === 0 ? (
                            <>
                                <p className="text-lg font-medium">No documents indexed yet</p>
                                <p className="text-sm mt-2 max-w-md mx-auto">
                                    Search runs over DOJ documents that have been indexed. An admin can run the &ldquo;Index DOJ documents&rdquo; action from the Admin dashboard to add documents, then search will return results.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-lg font-medium">No documents found</p>
                                <p className="text-sm mt-2">Try different search terms</p>
                            </>
                        )
                    ) : (
                        <>
                            <p className="text-lg font-medium">No documents indexed yet</p>
                            <p className="text-sm mt-2 max-w-md mx-auto">
                                An admin can run the &ldquo;Index DOJ documents&rdquo; action from the Admin dashboard to add DOJ documents for search.
                            </p>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {documents.map((doc) => (
                        <Link key={doc.id} href={`/epstein-files/${doc.id}`} className="block group">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:translate-y-[-1px]">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors truncate">
                                                {doc.title}
                                            </h3>
                                        </div>
                                        {doc.summary && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                                                {doc.summary}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-4 text-xs text-slate-400">
                                            {doc.documentType && (
                                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                    {doc.documentType}
                                                </span>
                                            )}
                                            {doc.pageCount && <span>{doc.pageCount} pages</span>}
                                            {doc.filedDate && <span>{new Date(doc.filedDate).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-slate-300 shrink-0 group-hover:text-blue-500 transition-colors" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {total > 20 && (
                <div className="flex justify-center gap-2 mt-8">
                    {page > 1 && (
                        <Link
                            href={`/epstein-files?${q ? `q=${q}&` : ''}page=${page - 1}`}
                            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Previous
                        </Link>
                    )}
                    <span className="px-4 py-2 text-sm text-slate-500">
                        Page {page} of {Math.ceil(total / 20)}
                    </span>
                    {page * 20 < total && (
                        <Link
                            href={`/epstein-files?${q ? `q=${q}&` : ''}page=${page + 1}`}
                            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Next
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
