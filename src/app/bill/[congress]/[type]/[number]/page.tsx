import { bills, billVersions } from '@/lib/db';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import type { BillSummary } from '@/types/ai-schemas';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: {
        congress: string;
        type: string;
        number: string;
    };
}

// Since Next.js 15, params is async, but wait, looking at user context Next.js version is 16.
// In Next.js 15+ params should be awaited if they are used in async functions component. 
// However, the standard signature for page component props still treats params as distinct. 
// Actually, let's treat it as a Promise just to be safe with latest canary versions, 
// or just access it directly if we assume stable App Router behavior.
// To be safe in Next 15/16: 
// export default async function BillPage({ params }: { params: Promise<{ ... }> })
// But let's check what version logic I should use. The user console logs showed "Next.js 16.1.1".
// In Next 15, `params` is a Promise.

export default async function BillPage({ params }: { params: Promise<{ congress: string; type: string; number: string }> }) {
    const { congress, type, number } = await params;

    const bill = await bills.findByCompositeKey(parseInt(congress), type, number);
    if (!bill) notFound();

    const versions = await billVersions.findByBill(bill.id, { orderBy: { field: 'date', direction: 'desc' } });
    const displayedVersion = versions.find((v) => v.summary) || versions[0] || null;
    const summary = displayedVersion?.summary as unknown as BillSummary | null;

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <Link href="/bills" className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 mb-6 transition">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to all bills
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Summary & Analysis */}
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-sm font-semibold uppercase tracking-wide">
                                {bill.type.toUpperCase()} {bill.number}
                            </span>
                            <span className="text-slate-500 text-sm font-mono">{bill.congress}th Congress</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4 leading-tight">
                            {bill.title}
                        </h1>
                    </div>

                    {!summary ? (
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-500">
                            <p className="text-lg">AI Summary is generating...</p>
                            <p className="text-sm mt-2">Check back in a few minutes.</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                <h2 className="font-semibold text-lg flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    AI Summary
                                </h2>
                                <span className="text-xs text-slate-500 font-mono">
                                    ver. {displayedVersion.code} • {summary.overall_confidence} confidence
                                </span>
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">TL;DR</h3>
                                    <ul className="space-y-3">
                                        {summary.tldr_bullets.map((bullet, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                                                <span className="text-slate-800 dark:text-slate-200 leading-relaxed">{bullet.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-green-600 mb-3">What it Does</h3>
                                        <ul className="space-y-2">
                                            {summary.what_it_does.map((item, idx) => (
                                                <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-100 dark:border-green-900/20">
                                                    {item.text}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-red-500 mb-3">What it Does NOT Do</h3>
                                        <ul className="space-y-2">
                                            {summary.what_it_does_not_do.map((item, idx) => (
                                                <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/20">
                                                    {item.text}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Plain English Overview</h3>
                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                                        {summary.plain_english_overview}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar: Metadata */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Status & Info</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-semibold">Status</label>
                                <div className="mt-1 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 relative animate-pulse"></span>
                                    <span className="font-medium">{bill.status || "Unknown"}</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 uppercase font-semibold">Introduced Date</label>
                                <div className="mt-1 flex items-center gap-2 text-sm">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    {bill.introDate ? format(new Date(bill.introDate), 'MMMM d, yyyy') : 'N/A'}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 uppercase font-semibold">Latest Version</label>
                                <div className="mt-1 flex items-center gap-2 text-sm">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <span className="uppercase">{displayedVersion?.code || 'N/A'}</span>
                                    <span className="text-slate-400 text-xs">
                                        ({displayedVersion?.date ? format(new Date(displayedVersion.date), 'MMM d') : '-'})
                                    </span>
                                </div>
                            </div>

                            {displayedVersion?.textUrl && (
                                <a
                                    href={displayedVersion.textUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex w-full items-center justify-center gap-2 px-4 py-2 mt-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md text-sm font-medium transition"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Read Full Text
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
