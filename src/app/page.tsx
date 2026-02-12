import Link from 'next/link';
import { ArrowRight, Flame, CheckCircle2, Shield, Search } from 'lucide-react';
import { BillCard, ClaimCard } from '@/components/Cards';
import { bills, claims } from '@/lib/db';
import { isFirestoreAvailable } from '@/lib/firestore';

export const dynamic = 'force-dynamic';

export default async function Home() {
    let trendingBills: any[] = [];
    let recentClaims: any[] = [];

    if (isFirestoreAvailable()) {
        try {
            const [billsResult, recentClaimsRaw] = await Promise.all([
                bills.findMany({ orderBy: { field: 'updatedAt', direction: 'desc' }, take: 4 }),
                claims.findMany({ where: { status: 'checked' }, orderBy: { field: 'updatedAt', direction: 'desc' }, take: 3 }),
            ]);
            trendingBills = billsResult;
            recentClaims = await Promise.all(
                recentClaimsRaw.map(async (c) => ({
                    ...c,
                    bill: c.billId ? await bills.findById(c.billId) : null,
                }))
            );
        } catch (e) {
            console.error('Failed to fetch data from Firestore:', e);
        }
    }

    return (
        <div className="space-y-16 pb-20">
            {/* Hero */}
            <section className="relative overflow-hidden pt-16 pb-12 sm:pb-24 lg:pb-32 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.1),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.05),transparent)]" />
                <div className="container mx-auto px-4 text-center relative">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
                        <Shield size={14} />
                        Non-partisan, AI-powered analysis
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
                        Understand Legislation. <br className="hidden sm:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                            Verify the Claims.
                        </span>
                    </h1>
                    <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-8">
                        An automated tracker that uses AI to summarize bills and fact-check viral rumors directly against the official text.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link href="/claims" className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 md:text-lg transition-all shadow-lg shadow-blue-500/25">
                            <Search size={18} />
                            Check a Claim
                        </Link>
                        <Link href="/bills" className="inline-flex items-center justify-center px-6 py-3 border border-slate-300 dark:border-slate-700 text-base font-medium rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 md:text-lg transition-all">
                            Browse Bills
                        </Link>
                        <Link href="/epstein-files" className="inline-flex items-center justify-center px-6 py-3 border border-slate-300 dark:border-slate-700 text-base font-medium rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 md:text-lg transition-all">
                            Epstein Files
                        </Link>
                    </div>
                </div>
            </section>

            {/* Trending Bills */}
            <section className="container mx-auto px-4">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600"><Flame size={20} /></div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Trending in Congress</h2>
                    </div>
                    <Link href="/bills" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 text-sm">
                        View all <ArrowRight size={16} />
                    </Link>
                </div>
                {trendingBills.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {trendingBills.map((bill) => (
                            <BillCard key={bill.id} bill={bill} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <p>No bills tracked yet. Visit the admin dashboard to trigger ingestion.</p>
                    </div>
                )}
            </section>

            {/* Recent Fact Checks */}
            <section className="container mx-auto px-4">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-xl text-green-600"><CheckCircle2 size={20} /></div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Recent Fact Checks</h2>
                    </div>
                    <Link href="/claims" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 text-sm">
                        View all <ArrowRight size={16} />
                    </Link>
                </div>
                {recentClaims.length > 0 ? (
                    <div className="grid md:grid-cols-3 gap-6">
                        {recentClaims.map((claim) => (
                            <ClaimCard key={claim.id} claim={claim} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <p>No fact checks yet. <Link href="/claims" className="text-blue-600 hover:underline">Submit a claim</Link> to get started.</p>
                    </div>
                )}
            </section>
        </div>
    );
}
