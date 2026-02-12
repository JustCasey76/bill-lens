import { epsteinDocuments } from '@/lib/db';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, FileText, Calendar, BookOpen, Hash, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EpsteinDocumentPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const doc = await epsteinDocuments.findById(id);
    if (!doc) notFound();

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <Link href="/epstein-files" className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 mb-6 transition">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to all documents
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Title */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-5 h-5 text-slate-400" />
                            {doc.documentType && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                                    {doc.documentType}
                                </span>
                            )}
                            {doc.fileType && (
                                <span className="text-xs text-slate-400 uppercase font-mono">{doc.fileType}</span>
                            )}
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {doc.title}
                        </h1>
                    </div>

                    {/* Summary */}
                    {doc.summary && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
                            <h2 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                AI Summary
                            </h2>
                            <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                                {doc.summary}
                            </p>
                        </div>
                    )}

                    {/* Document Text */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h2 className="font-semibold text-sm">Extracted Text</h2>
                            {doc.pageCount && (
                                <span className="text-xs text-slate-500">{doc.pageCount} pages</span>
                            )}
                        </div>
                        <div className="p-5 max-h-[600px] overflow-y-auto">
                            {doc.rawText ? (
                                <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                                    {doc.rawText}
                                </pre>
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-8">
                                    Text content not available for this document.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Source Link */}
                    <a
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
                    >
                        <ExternalLink className="w-4 h-4" />
                        View Original PDF
                    </a>

                    {/* Metadata */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Document Info</h3>
                        <div className="space-y-4 text-sm">
                            {doc.caseNumber && (
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-semibold flex items-center gap-1">
                                        <Hash className="w-3 h-3" /> Case Number
                                    </label>
                                    <p className="mt-1 font-mono">{doc.caseNumber}</p>
                                </div>
                            )}
                            {doc.filedDate && (
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-semibold flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Filed Date
                                    </label>
                                    <p className="mt-1">{format(new Date(doc.filedDate), 'MMMM d, yyyy')}</p>
                                </div>
                            )}
                            {doc.parties && doc.parties.length > 0 && (
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-semibold flex items-center gap-1">
                                        <Users className="w-3 h-3" /> Parties
                                    </label>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {doc.parties.map((p, i) => (
                                            <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs">
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-semibold">Status</label>
                                <p className="mt-1 capitalize">{doc.status}</p>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-semibold">Indexed</label>
                                <p className="mt-1">{format(new Date(doc.createdAt), 'MMM d, yyyy')}</p>
                            </div>
                            {doc.pageCount && (
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-semibold">Pages</label>
                                    <p className="mt-1">{doc.pageCount}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
