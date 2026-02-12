import { claims } from '@/lib/db';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';
import {
    ArrowLeft, ExternalLink, BadgeCheck, AlertTriangle, XCircle,
    HelpCircle, Clock, FileText, Shield, Quote, AlertOctagon
} from 'lucide-react';
import type { ClaimCheck } from '@/types/ai-schemas';

export const dynamic = 'force-dynamic';

const verdictDisplay: Record<string, { color: string; bg: string; icon: any; label: string }> = {
    Accurate: { color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800', icon: BadgeCheck, label: 'Accurate' },
    PartiallyAccurate: { color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800', icon: AlertTriangle, label: 'Partially Accurate' },
    Misleading: { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800', icon: AlertTriangle, label: 'Misleading' },
    False: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800', icon: XCircle, label: 'False' },
    Unsupported: { color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700', icon: HelpCircle, label: 'Unsupported' },
};

export default async function ClaimDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const result = await claims.findByIdWithBill(id);
    if (!result) notFound();
    const { claim, bill } = result;

    const analysis = claim.analysis as unknown as ClaimCheck | null;
    const vConfig = verdictDisplay[claim.verdict || 'Unsupported'] || verdictDisplay.Unsupported;
    const VerdictIcon = vConfig.icon;

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <Link href="/claims" className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 mb-6 transition">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to fact checks
            </Link>

            {/* Verdict Banner */}
            <div className={`rounded-xl border p-6 mb-8 ${vConfig.bg}`}>
                <div className="flex items-center gap-3 mb-3">
                    <VerdictIcon className={`w-8 h-8 ${vConfig.color}`} />
                    <span className={`text-2xl font-bold ${vConfig.color}`}>{vConfig.label}</span>
                    {analysis?.confidence && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/60 dark:bg-black/20 text-slate-600 dark:text-slate-300">
                            {analysis.confidence} confidence
                        </span>
                    )}
                </div>
                <blockquote className="text-lg font-medium text-slate-800 dark:text-slate-200 border-l-4 border-current pl-4 ml-1 italic">
                    &ldquo;{claim.content}&rdquo;
                </blockquote>
                {claim.sourceUrl && (
                    <a
                        href={claim.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-sm text-blue-600 hover:underline"
                    >
                        <ExternalLink className="w-3 h-3" /> Source
                    </a>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {claim.status === 'pending' ? (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-8 text-center">
                            <Clock className="w-10 h-10 mx-auto mb-3 text-yellow-500 animate-pulse" />
                            <p className="text-lg font-medium text-yellow-700 dark:text-yellow-400">Fact-checking in progress...</p>
                            <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-2">This claim is being analyzed. Check back shortly.</p>
                        </div>
                    ) : claim.status === 'error' ? (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
                            <AlertOctagon className="w-10 h-10 mx-auto mb-3 text-red-500" />
                            <p className="text-lg font-medium text-red-700 dark:text-red-400">Analysis failed</p>
                            <p className="text-sm text-red-600 dark:text-red-500 mt-2">There was an error processing this claim. It may be re-queued automatically.</p>
                        </div>
                    ) : analysis ? (
                        <>
                            {/* Explanation */}
                            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                                <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-blue-600" />
                                    Explanation
                                </h2>
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {analysis.explanation}
                                </p>
                            </section>

                            {/* What the Bill Actually Says */}
                            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                                <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-600" />
                                    What the Bill Actually Says
                                </h2>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {analysis.what_the_bill_says}
                                </div>
                            </section>

                            {/* Evidence & Citations */}
                            {analysis.evidence && analysis.evidence.length > 0 && (
                                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                                    <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Quote className="w-5 h-5 text-green-600" />
                                        Evidence
                                    </h2>
                                    <div className="space-y-4">
                                        {analysis.evidence.map((e, idx) => (
                                            <div key={idx} className="border-l-4 border-blue-400 pl-4 py-2">
                                                <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mb-1">
                                                    {e.section}
                                                </p>
                                                <blockquote className="text-sm italic text-slate-600 dark:text-slate-400">
                                                    &ldquo;{e.quote}&rdquo;
                                                </blockquote>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Common Misunderstandings */}
                            {analysis.common_misunderstandings && analysis.common_misunderstandings.length > 0 && (
                                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                                    <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                                        Common Misunderstandings
                                    </h2>
                                    <ul className="space-y-2">
                                        {analysis.common_misunderstandings.map((m, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                                {m}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {/* Limitations */}
                            {analysis.limitations && (
                                <section className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Limitations</h2>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">{analysis.limitations}</p>
                                </section>
                            )}
                        </>
                    ) : null}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Related Bill */}
                    {bill && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Related Bill</h3>
                            <Link
                                href={`/bill/${bill.congress}/${bill.type}/${bill.number}`}
                                className="block p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                            >
                                <span className="text-xs font-mono text-blue-600 dark:text-blue-400 uppercase">
                                    {bill.type.toUpperCase()} {bill.number}
                                </span>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1 line-clamp-2">
                                    {bill.title}
                                </p>
                            </Link>
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Details</h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-semibold">Status</label>
                                <p className="mt-1 font-medium capitalize">{claim.status}</p>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-semibold">Checked At</label>
                                <p className="mt-1">{format(new Date(claim.updatedAt), 'MMMM d, yyyy h:mm a')}</p>
                            </div>
                            {analysis?.last_checked && (
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-semibold">AI Analysis Date</label>
                                    <p className="mt-1">{format(new Date(analysis.last_checked), 'MMMM d, yyyy')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
