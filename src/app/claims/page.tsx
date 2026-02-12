import { claims, bills } from '@/lib/db';
import { ClaimCard } from '@/components/Cards';
import { ClaimSubmitForm } from '@/components/ClaimSubmitForm';
import { Shield, Filter } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const verdictFilters = [
    { label: 'All', value: '' },
    { label: 'Accurate', value: 'Accurate' },
    { label: 'Partially Accurate', value: 'PartiallyAccurate' },
    { label: 'Misleading', value: 'Misleading' },
    { label: 'False', value: 'False' },
    { label: 'Unsupported', value: 'Unsupported' },
];

export default async function ClaimsPage({
    searchParams,
}: {
    searchParams: Promise<{ verdict?: string; q?: string; page?: string }>;
}) {
    const { verdict, q } = await searchParams;

    const [checkedClaimsRaw, pendingCount] = await Promise.all([
        claims.findMany({
            where: {
                status: 'checked',
                ...(verdict ? { verdict } : {}),
                ...(q ? { contentContains: q } : {}),
            },
            orderBy: { field: 'updatedAt', direction: 'desc' },
            take: 50,
        }),
        claims.count({ status: 'pending' }),
    ]);
    const checkedClaims = await Promise.all(
        checkedClaimsRaw.map(async (c) => ({
            ...c,
            bill: c.billId ? await bills.findById(c.billId) : null,
        }))
    );

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                        <Shield size={22} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Fact Checks</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Search social media claims and verify them against official bill text
                        </p>
                    </div>
                </div>
            </div>

            {/* Claim Submission */}
            <div className="mb-10">
                <ClaimSubmitForm />
            </div>

            {/* Verdict Filters */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                <Filter size={16} className="text-slate-400 shrink-0" />
                {verdictFilters.map((f) => {
                    const isActive = (verdict || '') === f.value;
                    return (
                        <Link
                            key={f.value}
                            href={`/claims${f.value ? `?verdict=${f.value}` : ''}${q ? `${f.value ? '&' : '?'}q=${q}` : ''}`}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                                isActive
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                        >
                            {f.label}
                        </Link>
                    );
                })}
                {pendingCount > 0 && (
                    <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        {pendingCount} processing...
                    </span>
                )}
            </div>

            {/* Results */}
            {checkedClaims.length === 0 ? (
                <div className="text-center py-20 text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <Shield size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <p className="text-lg font-medium">No fact checks yet</p>
                    <p className="text-sm mt-2">Submit a claim above to get started</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {checkedClaims.map((claim) => (
                        <ClaimCard key={claim.id} claim={claim} />
                    ))}
                </div>
            )}
        </div>
    );
}
